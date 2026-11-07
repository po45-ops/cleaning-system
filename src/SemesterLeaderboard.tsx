import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, RefreshCw, Trophy, X } from "lucide-react";

import { formatDateKey, parseLocalDate } from "./date-utils";

type Inspection = {
  id: string | number;
  date: string;
  zoneId: string | number;
  score: string | number | null;
  status: "pending" | "approved" | "rejected";
  updatedAt?: string;
  timestamp?: string;
  createdAt?: string;
};

type ApiResponse = {
  status?: string;
  data?: unknown[];
};

type SemesterMeta = {
  startKey: string;
  term: string;
  academicYear: string;
};

type ScoreRow = {
  zoneId: number;
  className: string;
  totalScore: number;
  recordCount: number;
  average: number | null;
};

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwfmqSlIqJ0-2CoAQ1Uv7nrL47x3zsqToUWP0brNiHBnJGFIvz450w33ANBmltvOjNPTg/exec";
const LOAD_TIMEOUT_MS = 15_000;

const ZONES = [
  { id: 1, className: "ป.1" },
  { id: 2, className: "ป.2" },
  { id: 3, className: "ป.3" },
  { id: 4, className: "ป.4" },
  { id: 5, className: "ป.5" },
  { id: 6, className: "ป.6" },
  { id: 7, className: "ม.1" },
  { id: 8, className: "ม.2" },
  { id: 9, className: "ม.3" },
] as const;

const formatThaiDate = (value: string): string => {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const isInspection = (value: unknown): value is Inspection => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.id === "string" || typeof record.id === "number") &&
    typeof record.date === "string" &&
    (typeof record.zoneId === "string" || typeof record.zoneId === "number") &&
    ["pending", "approved", "rejected"].includes(String(record.status))
  );
};

const getRevision = (record: Inspection): number => {
  for (const value of [record.updatedAt, record.timestamp, record.createdAt]) {
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const numericId = Number(record.id);
  if (Number.isFinite(numericId)) return numericId;
  return parseLocalDate(record.date).getTime() || 0;
};

const pickLatest = (
  current: Inspection | undefined,
  candidate: Inspection
): Inspection => {
  if (!current) return candidate;
  return getRevision(candidate) >= getRevision(current) ? candidate : current;
};

const getDefaultSemesterMeta = (today: Date): SemesterMeta => {
  const year = today.getFullYear();
  const month = today.getMonth();

  if (month >= 4 && month <= 9) {
    return {
      startKey: `${year}-05-01`,
      term: "1",
      academicYear: String(year + 543),
    };
  }

  if (month >= 10) {
    return {
      startKey: `${year}-11-01`,
      term: "2",
      academicYear: String(year + 543),
    };
  }

  return {
    startKey: `${year - 1}-11-01`,
    term: "2",
    academicYear: String(year - 1 + 543),
  };
};

const readSemesterMeta = (today: Date): SemesterMeta => {
  const fallback = getDefaultSemesterMeta(today);
  try {
    const saved = window.localStorage.getItem("cleaning_report_settings");
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return {
      startKey:
        typeof parsed.semesterStart === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.semesterStart)
          ? parsed.semesterStart
          : fallback.startKey,
      term:
        typeof parsed.term === "string" && parsed.term.trim()
          ? parsed.term
          : fallback.term,
      academicYear:
        typeof parsed.year === "string" && parsed.year.trim()
          ? parsed.year
          : fallback.academicYear,
    };
  } catch {
    return fallback;
  }
};

const findOverviewContent = (): HTMLElement | null => {
  const heading = Array.from(document.querySelectorAll("h2")).find(
    (element) => element.textContent?.trim() === "สรุปภาพรวมวันนี้"
  );
  const section = heading?.closest("section");
  if (!section) return null;

  return (
    Array.from(section.children).find(
      (element) =>
        element instanceof HTMLElement &&
        element.className.includes("space-y-6")
    ) as HTMLElement | undefined
  ) || null;
};

export default function SemesterLeaderboard(): React.ReactElement | null {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detailZoneId, setDetailZoneId] = useState<number | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);
  const semesterMeta = readSemesterMeta(today);

  useEffect(() => {
    const syncPortalHost = () => {
      const content = findOverviewContent();
      if (!content) {
        setPortalHost(null);
        return;
      }

      const existing = content.querySelector<HTMLElement>(
        "[data-semester-leaderboard-host='true']"
      );
      if (existing) {
        setPortalHost(existing);
        return;
      }

      const host = document.createElement("div");
      host.dataset.semesterLeaderboardHost = "true";
      const footer = Array.from(content.children).find(
        (element) =>
          element.tagName === "P" &&
          element.textContent?.includes("ระบบอัปเดตข้อมูลอัตโนมัติ")
      );
      content.insertBefore(host, footer || null);
      setPortalHost(host);
    };

    syncPortalHost();
    const observer = new MutationObserver(syncPortalHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let requestSequence = 0;
    let activeController: AbortController | null = null;

    const load = async () => {
      const currentSequence = ++requestSequence;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        LOAD_TIMEOUT_MS
      );

      try {
        const response = await fetch(`${SCRIPT_URL}?refresh=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("load failed");
        const result = (await response.json()) as ApiResponse;
        if (result.status !== "success") throw new Error("load failed");
        if (!active || currentSequence !== requestSequence) return;
        setInspections(
          (Array.isArray(result.data) ? result.data : []).filter(isInspection)
        );
        setLoadError(false);
      } catch {
        if (active && currentSequence === requestSequence) setLoadError(true);
      } finally {
        window.clearTimeout(timeoutId);
        if (active && currentSequence === requestSequence) {
          if (activeController === controller) activeController = null;
          setIsLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      requestSequence += 1;
      activeController?.abort();
      activeController = null;
      window.clearInterval(timer);
    };
  }, []);

  const ranking = useMemo(() => {
    const latestByDayAndZone = new Map<string, Inspection>();

    inspections.forEach((record) => {
      const zoneId = Number(record.zoneId);
      if (!ZONES.some((zone) => zone.id === zoneId)) return;
      const dateKey = formatDateKey(record.date);
      if (dateKey < semesterMeta.startKey || dateKey > todayKey) return;
      const key = `${dateKey}:${zoneId}`;
      latestByDayAndZone.set(
        key,
        pickLatest(latestByDayAndZone.get(key), record)
      );
    });

    const totals = new Map<number, { total: number; count: number }>();
    latestByDayAndZone.forEach((record) => {
      if (record.status !== "approved") return;
      const score = Number(record.score);
      const zoneId = Number(record.zoneId);
      if (!Number.isFinite(score)) return;
      const current = totals.get(zoneId) || { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      totals.set(zoneId, current);
    });

    const rows: ScoreRow[] = ZONES.map((zone) => {
      const value = totals.get(zone.id) || { total: 0, count: 0 };
      return {
        zoneId: zone.id,
        className: zone.className,
        totalScore: value.total,
        recordCount: value.count,
        average: value.count ? value.total / value.count : null,
      };
    }).sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        (b.average || 0) - (a.average || 0) ||
        a.zoneId - b.zoneId
    );

    const activeRows = rows.filter((row) => row.recordCount > 0);
    return {
      rows,
      topThree: activeRows.slice(0, 3),
      maxScore: Math.max(1, ...rows.map((row) => row.totalScore)),
      totalApprovedRecords: rows.reduce(
        (sum, row) => sum + row.recordCount,
        0
      ),
    };
  }, [inspections, semesterMeta.startKey, todayKey]);

  if (!portalHost) return null;

  const medals = ["🥇", "🥈", "🥉"];
  const podiumOrder = [1, 0, 2].filter((index) => ranking.topThree[index]);
  const podiumStyle = [
    "h-[8rem] border-amber-200 bg-gradient-to-b from-amber-100 to-amber-50",
    "h-[7rem] border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50",
    "h-[6rem] border-orange-200 bg-gradient-to-b from-orange-100 to-orange-50",
  ];
  const restRows = ranking.rows
    .map((row, index) => ({ row, rank: index + 1 }))
    .filter(({ rank }) => rank > ranking.topThree.length);
  const detailRank = ranking.rows.findIndex((row) => row.zoneId === detailZoneId);
  const detailRow = detailRank >= 0 ? ranking.rows[detailRank] : null;

  return createPortal(
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-emerald-50/60 to-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-emerald-600 p-2.5 text-white shadow-sm">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-800 sm:text-lg">คะแนนสะสมแต่ละชั้น</h3>
            <p className="text-xs text-slate-500">
              ภาคเรียนที่ {semesterMeta.term} ปีการศึกษา {semesterMeta.academicYear}
            </p>
          </div>
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-100 sm:inline-flex">
          <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
          {formatThaiDate(semesterMeta.startKey)} – {formatThaiDate(todayKey)}
        </span>
      </div>

      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
            กำลังคำนวณคะแนนสะสม...
          </div>
        ) : ranking.topThree.length > 0 ? (
          <>
            <div className="mx-auto flex max-w-md items-end justify-center gap-2">
              {podiumOrder.map((index) => {
                const item = ranking.topThree[index];
                return (
                  <button
                    key={item.zoneId}
                    type="button"
                    onClick={() => setDetailZoneId(item.zoneId)}
                    className="flex min-w-0 flex-1 flex-col items-center transition active:scale-95"
                  >
                    <span className="text-3xl leading-none sm:text-4xl">{medals[index]}</span>
                    <div
                      className={`mt-1 flex w-full flex-col items-center justify-center rounded-t-2xl border px-1 ${podiumStyle[index]}`}
                    >
                      <span className="text-base font-black text-slate-800 sm:text-lg">
                        {item.className}
                      </span>
                      <span className="text-xl font-black leading-tight text-emerald-700 sm:text-2xl">
                        {item.totalScore}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">คะแนน</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mx-auto mt-3 max-w-2xl divide-y divide-slate-100 rounded-2xl bg-white px-3 shadow-sm ring-1 ring-slate-100">
              {restRows.map(({ row, rank }) => {
                const width = Math.max(
                  row.totalScore > 0 ? 4 : 0,
                  (row.totalScore / ranking.maxScore) * 100
                );
                return (
                  <button
                    key={row.zoneId}
                    type="button"
                    onClick={() => setDetailZoneId(row.zoneId)}
                    className="grid w-full grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 text-left transition hover:bg-emerald-50/40 sm:grid-cols-[32px_56px_minmax(0,1fr)_auto] sm:gap-3"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">
                      {rank}
                    </span>
                    <span className="text-sm font-black text-slate-800">{row.className}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="text-right text-sm font-black text-slate-800">
                      {row.totalScore}
                      <span className="ml-0.5 text-[10px] font-bold text-slate-400">คะแนน</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-9 text-center">
            <Trophy className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-500">
              ยังไม่มีคะแนนที่ครูอนุมัติในภาคเรียนนี้
            </p>
          </div>
        )}

        {loadError && !isLoading && (
          <p className="mt-3 text-center text-xs text-amber-600">
            การอัปเดตคะแนนสะสมรอบล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดได้ล่าสุด
          </p>
        )}
      </div>

      {detailRow && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
          onClick={() => setDetailZoneId(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`คะแนนสะสม ${detailRow.className}`}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-black text-slate-800">
                {detailRank < 3 && detailRow.recordCount > 0 ? medals[detailRank] + " " : ""}
                {detailRow.className}
              </p>
              <button
                type="button"
                aria-label="ปิด"
                onClick={() => setDetailZoneId(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ["อันดับ", String(detailRank + 1)],
                ["คะแนนสะสม", String(detailRow.totalScore)],
                ["จำนวนครั้ง", `${detailRow.recordCount} ครั้ง`],
                ["ค่าเฉลี่ย", detailRow.average === null ? "–" : `${detailRow.average.toFixed(2)} / 3`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-3">
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>,
    portalHost
  );
}
