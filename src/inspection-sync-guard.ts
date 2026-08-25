const LEGACY_CLEANING_DATA_API_URL =
  "https://script.google.com/macros/s/AKfycbyTSx3ggaJfXtYd_rQ67FoI5pPb8y_LXcTAm6RiSnkf34uiZL5GZBStGVMXyGCHQ5JfEA/exec";
const CURRENT_CLEANING_DATA_API_URL =
  "https://script.google.com/macros/s/AKfycbwfmqSlIqJ0-2CoAQ1Uv7nrL47x3zsqToUWP0brNiHBnJGFIvz450w33ANBmltvOjNPTg/exec";

const OPTIMISTIC_STATUS_TTL_MS = 2 * 60 * 1000;

type PendingStatusUpdate = {
  id: string;
  zoneId: number;
  dateKey: string;
  status: "approved" | "rejected";
  savedAt: number;
};

type InspectionLike = {
  id?: string | number;
  zoneId?: string | number;
  date?: string;
  status?: string;
  updatedAt?: string;
  timestamp?: string;
  createdAt?: string;
  [key: string]: unknown;
};

const pendingStatusUpdates = new Map<string, PendingStatusUpdate>();
let installed = false;

const formatDateKey = (value: unknown): string => {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const isCleaningDataRequest = (url: string): boolean =>
  url.includes(LEGACY_CLEANING_DATA_API_URL) ||
  url.includes(CURRENT_CLEANING_DATA_API_URL);

const rewriteCleaningDataRequest = (
  input: RequestInfo | URL
): RequestInfo | URL => {
  const originalUrl = getRequestUrl(input);
  if (!originalUrl.includes(LEGACY_CLEANING_DATA_API_URL)) return input;

  const rewrittenUrl = originalUrl.replace(
    LEGACY_CLEANING_DATA_API_URL,
    CURRENT_CLEANING_DATA_API_URL
  );

  if (typeof input === "string") return rewrittenUrl;
  if (input instanceof URL) return new URL(rewrittenUrl);
  return new Request(rewrittenUrl, input);
};

const mutationKey = (update: PendingStatusUpdate): string =>
  update.id
    ? `id:${update.id}`
    : `date-zone:${update.dateKey}|${update.zoneId}`;

const recordMatchesUpdate = (
  record: InspectionLike,
  update: PendingStatusUpdate
): boolean => {
  const recordId = String(record.id ?? "").trim();
  if (update.id && recordId === update.id) return true;

  return (
    Number(record.zoneId) === update.zoneId &&
    formatDateKey(record.date) === update.dateKey
  );
};

const parseJsonBody = (body: BodyInit | null | undefined) => {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const rememberSuccessfulStatusUpdate = async (
  response: Response,
  body: BodyInit | null | undefined
) => {
  const payload = parseJsonBody(body);
  if (!payload || payload.action !== "update") return;

  const status = String(payload.status || "");
  if (status !== "approved" && status !== "rejected") return;

  try {
    const result = (await response.clone().json()) as { status?: string };
    if (result.status !== "success") return;
  } catch {
    return;
  }

  const update: PendingStatusUpdate = {
    id: String(payload.id ?? "").trim(),
    zoneId: Number(payload.zoneId),
    dateKey: formatDateKey(payload.date),
    status,
    savedAt: Date.now(),
  };

  pendingStatusUpdates.set(mutationKey(update), update);
};

const mergePendingStatusUpdates = async (response: Response) => {
  if (!response.ok || pendingStatusUpdates.size === 0) return response;

  let json: { status?: string; data?: unknown[] };
  try {
    json = (await response.clone().json()) as { status?: string; data?: unknown[] };
  } catch {
    return response;
  }

  if (json.status !== "success" || !Array.isArray(json.data)) return response;

  const now = Date.now();
  const data = json.data.map((item) => ({ ...(item as InspectionLike) }));
  let changed = false;

  pendingStatusUpdates.forEach((update, key) => {
    if (now - update.savedAt > OPTIMISTIC_STATUS_TTL_MS) {
      pendingStatusUpdates.delete(key);
      return;
    }

    const recordIndex = data.findIndex((record) =>
      recordMatchesUpdate(record, update)
    );
    if (recordIndex < 0) return;

    const record = data[recordIndex];
    if (record.status === update.status) {
      // Google Sheets has caught up, so the server can be authoritative again.
      pendingStatusUpdates.delete(key);
      return;
    }

    // The write endpoint already returned success, but the immediate GET can
    // briefly return the previous row state. Keep the successful approval in
    // the UI until the Sheets read catches up instead of showing "pending" again.
    data[recordIndex] = {
      ...record,
      status: update.status,
      updatedAt: new Date(update.savedAt).toISOString(),
    };
    changed = true;
  });

  if (!changed) return response;

  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ ...json, data }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * App.tsx still contains the previous Apps Script deployment URL. Redirect all
 * cleaning API traffic to the current deployment before it leaves the browser,
 * and keep successful approve/reject results stable until Google Sheets reads
 * back the new status.
 */
export const installInspectionSyncGuard = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const originalUrl = getRequestUrl(input);
    const requestInput = rewriteCleaningDataRequest(input);
    const requestUrl = getRequestUrl(requestInput);
    const method = String(
      init?.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    const response = await originalFetch(requestInput, init);
    if (!isCleaningDataRequest(originalUrl) && !isCleaningDataRequest(requestUrl)) {
      return response;
    }

    if (method === "POST") {
      await rememberSuccessfulStatusUpdate(response, init?.body);
      return response;
    }

    if (method === "GET") {
      return mergePendingStatusUpdates(response);
    }

    return response;
  };
};
