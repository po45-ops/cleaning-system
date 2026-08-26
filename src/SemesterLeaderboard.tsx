import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, CalendarDays, RefreshCw, Trophy } from "lucide-react";

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

const getRankCardClass = (index: number): string => {
  if (index === 0) {
    return "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50";
  }
  if (index === 1) {
    return "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100";
  }
  return "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50";
};

export default function SemesterLeaderboard(): React.ReactElement | null {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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

  return createPortal(
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/70 px-5 py-5 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 sm:text-xl">
                คะแนนสะสมแต่ละชั้น
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
                คะแนนที่ครูอนุมัติแล้ว ตั้งแต่ต้นภาคเรียนถึงปัจจุบัน · ภาคเรียนที่ {semesterMeta.term} ปีการศึกษา {semesterMeta.academicYear}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            {formatThaiDate(semesterMeta.startKey)} – {formatThaiDate(todayKey)}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
            กำลังคำนวณคะแนนสะสม...
          </div>
        ) : ranking.topThree.length > 0 ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              {ranking.topThree.map((item, index) => (
                <div
                  key={item.zoneId}
                  className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${getRankCardClass(index)}`}
                >
                  <div className="absolute right-3 top-3 text-3xl opacity-80">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    อันดับ {index + 1}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800">
                    {item.className}
                  </p>
                  <p className="mt-3 text-3xl font-black text-emerald-700">
                    {item.totalScore}
                    <span className="ml-1 text-sm font-bold text-slate-400">
                      คะแนน
                    </span>
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.recordCount} ครั้ง</span>
                    <span>เฉลี่ย {item.average?.toFixed(2)}/3</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-black text-slate-800">
                      อันดับคะแนนสะสม
                    </p>
                    <p className="text-xs text-slate-500">
                      แผนภูมิแท่งเรียงจากคะแนนรวมสูงสุดลงมา
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
                  ผลอนุมัติทั้งหมด {ranking.totalApprovedRecords} ครั้ง
                </span>
              </div>

              <div className="space-y-3.5">
                {ranking.rows.map((item, index) => {
                  const width = Math.max(
                    item.totalScore > 0 ? 4 : 0,
                    (item.totalScore / ranking.maxScore) * 100
                  );
                  return (
                    <div
                      key={item.zoneId}
                      className="grid grid-cols-[52px_minmax(0,1fr)_72px] items-center gap-3 sm:grid-cols-[72px_minmax(0,1fr)_90px]"
                    >
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-700 sm:text-sm">
                          {index + 1}. {item.className}
                        </span>
                      </div>
                      <div className="relative h-8 overflow-hidden rounded-xl bg-white shadow-inner ring-1 ring-slate-100">
                        <div
                          className={`h-full rounded-xl transition-all duration-700 ${
                            index === 0 && item.recordCount > 0
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                              : index < 3 && item.recordCount > 0
                                ? "bg-gradient-to-r from-emerald-300 to-teal-300"
                                : "bg-gradient-to-r from-slate-300 to-slate-200"
                          }`}
                          style={{ width: `${width}%` }}
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-[11px] font-bold text-slate-600">
                          {item.recordCount > 0
                            ? `${item.recordCount} ครั้ง · เฉลี่ย ${item.average?.toFixed(2)}/3`
                            : "ยังไม่มีคะแนน"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-800 sm:text-base">
                          {item.totalScore}
                        </span>
                        <span className="ml-1 text-[10px] font-bold text-slate-400">
                          คะแนน
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          * คะแนนสะสมคำนวณจากผลตรวจที่ครูอนุมัติแล้วเท่านั้น หากมีการบันทึกซ้ำในวันเดียวกัน ระบบจะใช้รายการล่าสุดของเขตนั้น
        </p>
      </div>
    </article>,
    portalHost
  );
}
