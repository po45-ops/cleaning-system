/**
 * Server-side login for the Apps Script data API.
 *
 * - `serverLogin` asks Apps Script to verify the password and returns a
 *   short-lived session token (kept in localStorage with its expiry).
 * - `installServerAuth` wraps `fetch` so every JSON POST sent to the data API
 *   carries that token. Apps Script decides (server side) whether a request is
 *   allowed; hiding buttons in the UI is never treated as authorization.
 */

const DATA_API_MARKER = "script.google.com/macros/s/AKfycbwfmqSlIqJ0-2CoAQ1Uv7nrL47x3zsqToUWP0brNiHBnJGFIvz450w33ANBmltvOjNPTg";
const DATA_API_URL = `https://${DATA_API_MARKER}/exec`;
const SESSION_KEY = "cleaning_server_session";
export const AUTH_EXPIRED_EVENT = "cleaning-auth-expired";

type StoredSession = {
  token: string;
  role: "admin" | "student";
  id?: string;
  expiresAt: number;
};

export type ServerLoginResult =
  | { ok: true; role: "admin" | "student"; id?: string }
  | {
      ok: false;
      code: "not_configured" | "locked" | "invalid" | "network";
      message: string;
    };

const readSession = (): StoredSession | null => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SESSION_KEY) || "null"
    ) as Partial<StoredSession> | null;
    if (
      !parsed ||
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      (parsed.role !== "admin" && parsed.role !== "student")
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
};

export const getServerToken = (): string | null => readSession()?.token ?? null;

export const clearServerSession = (): void => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable in private windows; nothing to clear then.
  }
};

export const serverLogin = async (input: {
  role: "admin" | "student";
  id?: string;
  password: string;
}): Promise<ServerLoginResult> => {
  try {
    const response = await fetch(DATA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "login", ...input }),
    });
    const result = (await response.json()) as {
      status?: string;
      code?: string;
      message?: string;
      token?: string;
      role?: "admin" | "student";
      id?: string;
      expiresInSeconds?: number;
    };

    if (result.status === "success" && result.token && result.role) {
      const session: StoredSession = {
        token: result.token,
        role: result.role,
        id: result.role === "student" ? result.id : undefined,
        // Leave a minute of margin so we never send an about-to-expire token.
        expiresAt: Date.now() + ((result.expiresInSeconds ?? 21600) - 60) * 1000,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { ok: true, role: session.role, id: session.id };
    }

    if (result.code === "not_configured") {
      return { ok: false, code: "not_configured", message: result.message ?? "" };
    }
    if (result.code === "locked") {
      return { ok: false, code: "locked", message: result.message ?? "" };
    }
    return {
      ok: false,
      code: "invalid",
      message: result.message ?? "รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง",
    };
  } catch {
    return {
      ok: false,
      code: "network",
      message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง",
    };
  }
};

export const serverLogout = async (): Promise<void> => {
  const token = getServerToken();
  clearServerSession();
  if (!token) return;
  try {
    await fetch(DATA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "logout", token }),
    });
  } catch {
    // The token also expires on its own after a few hours.
  }
};

const isDataApiUrl = (input: RequestInfo | URL): boolean => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return url.includes(DATA_API_MARKER);
};

let installed = false;

export const installServerAuth = (): void => {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const method = String(
      init?.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    if (method !== "POST" || !isDataApiUrl(input) || typeof init?.body !== "string") {
      return originalFetch(input, init);
    }

    let nextInit = init;
    let hasToken = false;
    try {
      const payload = JSON.parse(init.body) as Record<string, unknown>;
      const token = getServerToken();
      if (
        payload &&
        typeof payload === "object" &&
        token &&
        payload.action !== "login" &&
        payload.action !== "logout"
      ) {
        hasToken = true;
        nextInit = { ...init, body: JSON.stringify({ ...payload, token }) };
      }
    } catch {
      // Not JSON (for example a Messenger webhook) - leave it untouched.
    }

    const response = await originalFetch(input, nextInit);
    if (hasToken) {
      response
        .clone()
        .json()
        .then((result: { code?: string }) => {
          if (result?.code === "unauthenticated") {
            clearServerSession();
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
          }
        })
        .catch(() => undefined);
    }
    return response;
  };
};
