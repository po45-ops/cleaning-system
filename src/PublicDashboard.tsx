import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Clock,
  ListChecks,
  Map as MapIcon,
  RefreshCw,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";

import { formatDateKey, parseLocalDate } from "./date-utils";

type PublicInspection = {
  id: string | number;
  date: string;
  zoneId: string | number;
  score: string | number | null;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  images?: string[];
  updatedAt?: string;
  timestamp?: string;
  createdAt?: string;
};

type PublicZone = {
  id: number;
  name: string;
  class?: string;
};

type PublicDashboardProps = {
  inspections: PublicInspection[];
  zones: readonly PublicZone[];
  isLoading: boolean;
  error: string;
  lastUpdated: Date | null;
  onRefresh: () => void;
  initialOpenZoneId?: number;
};

type ZoneState = "approved" | "pending" | "failed" | "missing";

type ZoneSummary = PublicZone & {
  record?: PublicInspection;
  state: ZoneState;
};

const getRecordRevision = (record: PublicInspection): number => {
  for (const value of [record.updatedAt, record.timestamp, record.createdAt]) {
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  const numericId = Number(record.id);
  if (Number.isFinite(numericId)) return numericId;

  const dateValue = parseLocalDate(record.date).getTime();
  return Number.isFinite(dateValue) ? dateValue : 0;
};

const pickLatest = (
  current: PublicInspection | undefined,
  candidate: PublicInspection
): PublicInspection => {
  if (!current) return candidate;
  return getRecordRevision(candidate) >= getRecordRevision(current)
    ? candidate
    : current;
};

const getRecordState = (record?: PublicInspection): ZoneState => {
  if (!record) return "missing";
  if (record.status === "pending") return "pending";
  if (record.status === "rejected" || Number(record.score) === 0) {
    return "failed";
  }
  return "approved";
};

const stateMeta: Record<
  ZoneState,
  {
    label: string;
    cardClass: string;
    iconClass: string;
    textClass: string;
  }
> = {
  approved: {
    label: "ตรวจแล้ว",
    cardClass: "border-emerald-200 bg-emerald-50/70",
    iconClass: "bg-emerald-600 text-white",
    textClass: "text-emerald-700",
  },
  pending: {
    label: "รออนุมัติ",
    cardClass: "border-amber-200 bg-amber-50/70",
    iconClass: "bg-amber-100 text-amber-600",
    textClass: "text-amber-700",
  },
  failed: {
    label: "ไม่ผ่าน",
    cardClass: "border-rose-200 bg-rose-50/70",
    iconClass: "bg-rose-100 text-rose-600",
    textClass: "text-rose-600",
  },
  missing: {
    label: "ยังไม่บันทึก",
    cardClass: "border-slate-200 bg-slate-50/80",
    iconClass: "bg-slate-200 text-slate-500",
    textClass: "text-slate-500",
  },
};

const StateIcon = ({ state }: { state: ZoneState }) => {
  if (state === "approved") return <CheckCircle className="h-5 w-5" />;
  if (state === "pending") return <Clock className="h-5 w-5" />;
  if (state === "failed") return <XCircle className="h-5 w-5" />;
  return <AlertCircle className="h-5 w-5" />;
};

const getZonePublicSummary = (zone: ZoneSummary): string => {
  if (zone.state === "missing") {
    return "วันนี้ยังไม่มีการบันทึกผลการตรวจ ควรติดตามการส่งข้อมูลของพื้นที่นี้";
  }

  if (zone.state === "pending") {
    return "ส่งผลการตรวจแล้ว และกำลังรอครูผู้ดูแลตรวจสอบ/อนุมัติ";
  }

  const score = Number(zone.record?.score);

  if (zone.state === "failed" || score === 0) {
    return "ตรวจแล้ว ได้ 0/3 อยู่ในระดับไม่ผ่าน ควรดำเนินการปรับปรุงพื้นที่";
  }

  if (score >= 3) {
    return "ตรวจแล้ว ได้ 3/3 อยู่ในระดับดีมาก พื้นที่มีผลการตรวจอยู่ในเกณฑ์ดี";
  }

  if (score === 2) {
    return "ตรวจแล้ว ได้ 2/3 อยู่ในระดับพอใช้ โดยรวมผ่านเกณฑ์และควรรักษาความเรียบร้อย";
  }

  if (score === 1) {
    return "ตรวจแล้ว ได้ 1/3 อยู่ในระดับควรปรับปรุง ควรติดตามและแก้ไขความเรียบร้อยของพื้นที่";
  }

  return "ตรวจเรียบร้อยแล้ว และมีผลการตรวจบันทึกในระบบวันนี้";
};

export default function PublicDashboard({
  inspections,
  zones,
  isLoading,
  error,
  lastUpdated,
  onRefresh,
  initialOpenZoneId,
}: PublicDashboardProps) {
  const [openZoneId, setOpenZoneId] = useState<number | null>(
    initialOpenZoneId ?? null
  );

  useEffect(() => {
    if (openZoneId === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenZoneId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openZoneId]);

  const today = new Date();
  const todayKey = formatDateKey(today);

  const dashboard = useMemo(() => {
    const todayByZone = new Map<number, PublicInspection>();

    inspections.forEach((record) => {
      const zoneId = Number(record.zoneId);
      if (!zones.some((zone) => zone.id === zoneId)) return;

      if (formatDateKey(record.date) === todayKey) {
        todayByZone.set(zoneId, pickLatest(todayByZone.get(zoneId), record));
      }
    });

    const zoneSummaries: ZoneSummary[] = zones.map((zone) => {
      const record = todayByZone.get(zone.id);
      return { ...zone, record, state: getRecordState(record) };
    });

    const approved = zoneSummaries.filter(
      (zone) => zone.state === "approved"
    ).length;
    const pending = zoneSummaries.filter(
      (zone) => zone.state === "pending"
    ).length;
    const failed = zoneSummaries.filter((zone) => zone.state === "failed").length;
    const missing = zoneSummaries.filter(
      (zone) => zone.state === "missing"
    ).length;
    const reviewed = approved + failed;

    const reviewedScores = zoneSummaries
      .filter(
        (zone) =>
          (zone.state === "approved" || zone.state === "failed") &&
          Number.isFinite(Number(zone.record?.score))
      )
      .map((zone) => Number(zone.record?.score));
    const average = reviewedScores.length
      ? reviewedScores.reduce((total, score) => total + score, 0) /
        reviewedScores.length
      : null;

    return {
      zoneSummaries,
      approved,
      pending,
      failed,
      missing,
      reviewed,
      average,
    };
  }, [inspections, todayKey, zones]);

  const openZone =
    openZoneId === null
      ? null
      : dashboard.zoneSummaries.find((zone) => zone.id === openZoneId) ?? null;

  const completionRate = zones.length
    ? Math.round((dashboard.reviewed / zones.length) * 100)
    : 0;

  const todayLabel = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  if (isLoading && inspections.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-24 text-center shadow-sm">
        <RefreshCw className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-slate-700">
          กำลังดึงข้อมูลล่าสุดจาก Google Sheets...
        </p>
        <p className="mt-1 text-sm text-slate-500">โปรดรอสักครู่</p>
      </div>
    );
  }

  if (error && inspections.length === 0) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-white px-6 py-20 text-center shadow-sm">
        <AlertCircle className="mx-auto mb-4 h-11 w-11 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-800">โหลดข้อมูลไม่สำเร็จ</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
        >
          <RefreshCw className="h-4 w-4" /> ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-8 sm:py-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="hidden items-center gap-2 text-emerald-700 sm:flex">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.16em]">
                ภาพรวมข้อมูลสด
              </span>
            </div>
            <h2 className="text-lg font-black tracking-tight text-slate-800 sm:mt-1 sm:text-3xl">
              สรุปภาพรวมวันนี้
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 sm:mt-1 sm:gap-2 sm:text-sm">
              <CalendarDays className="h-4 w-4" /> {todayLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:block">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {lastUpdated
                ? `อัปเดต ${new Intl.DateTimeFormat("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }).format(lastUpdated)} น.`
                : "รอการอัปเดต"}
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold sm:px-4 text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              รีเฟรช
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              แสดงข้อมูลล่าสุดที่โหลดสำเร็จอยู่ — การอัปเดตรอบล่าสุดขัดข้อง
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 bg-slate-50/50 p-3 sm:space-y-6 sm:p-7">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">ตรวจเสร็จแล้ว</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">
                  {dashboard.reviewed}
                  <span className="text-sm text-slate-400 sm:text-lg">/{zones.length} เขต</span>
                </p>
              </div>
              <div className="hidden rounded-2xl bg-emerald-50 p-3 text-emerald-600 sm:block">
                <ListChecks className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">รออนุมัติ</p>
                <p className="mt-2 text-3xl font-black text-amber-500">
                  {dashboard.pending}
                  
                </p>
              </div>
              <div className="hidden rounded-2xl bg-amber-50 p-3 text-amber-500 sm:block">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">คะแนนเฉลี่ย</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">
                  {dashboard.average === null
                    ? "–"
                    : dashboard.average.toFixed(1)}
                  <span className="text-base text-slate-400 sm:text-lg">/3</span>
                </p>
              </div>
              <div className="hidden rounded-2xl bg-emerald-50 p-3 text-emerald-600 sm:block">
                <Star className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">ไม่ผ่าน</p>
                <p className="mt-2 text-3xl font-black text-rose-500">
                  {dashboard.failed}
                  
                </p>
              </div>
              <div className="hidden rounded-2xl bg-rose-50 p-3 text-rose-500 sm:block">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <MapIcon className="h-5 w-5" />
                </div>
                <h3 className="whitespace-nowrap font-black text-slate-800">สถานะพื้นที่ตรวจวันนี้</h3>
              </div>
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                ส่งแล้ว {zones.length - dashboard.missing}/{zones.length}
              </span>
            </div>

            <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2.5 sm:gap-4">
              {dashboard.zoneSummaries.map((zone) => {
                const meta = stateMeta[zone.state];
                const hasNote = Boolean(zone.record?.notes?.trim());

                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setOpenZoneId(zone.id)}
                    aria-label={`${zone.name} ${meta.label}`}
                    className={`relative flex aspect-square min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition active:scale-95 hover:shadow-md ${meta.cardClass}`}
                  >
                    {hasNote && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" />
                    )}
                    <span className="text-[13px] font-black leading-tight text-slate-800 sm:text-base">
                      {zone.name}
                      {zone.class ? (
                        <span className="ml-0.5 text-[10px] font-medium text-slate-400 sm:text-xs">
                          ({zone.class})
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 ${meta.iconClass}`}
                    >
                      <StateIcon state={zone.state} />
                    </span>
                    <span className={`text-[11px] font-bold sm:text-xs ${meta.textClass}`}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {(
                ["approved", "pending", "failed", "missing"] as ZoneState[]
              ).map((state) => (
                <span key={state} className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      state === "approved"
                        ? "bg-emerald-500"
                        : state === "pending"
                          ? "bg-amber-400"
                          : state === "failed"
                            ? "bg-rose-500"
                            : "bg-slate-300"
                    }`}
                  />
                  {stateMeta[state].label}
                </span>
              ))}
            </div>
          </article>

        </div>

        {openZone && (
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
            onClick={() => setOpenZoneId(null)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={openZone.name}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
              <div className="mb-4 flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${stateMeta[openZone.state].iconClass}`}
                >
                  <StateIcon state={openZone.state} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black text-slate-800">
                    {openZone.name}
                    {openZone.class ? (
                      <span className="ml-1 text-sm font-medium text-slate-400">
                        ({openZone.class})
                      </span>
                    ) : null}
                  </p>
                  <p className={`text-sm font-bold ${stateMeta[openZone.state].textClass}`}>
                    {stateMeta[openZone.state].label}
                  </p>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="font-bold text-slate-500">คะแนน</dt>
                  <dd className="font-black text-slate-800">
                    {openZone.record && openZone.state !== "pending"
                      ? `${Number(openZone.record.score) || 0}/3`
                      : "–"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="mb-0.5 font-bold text-slate-500">หมายเหตุ</dt>
                  <dd className="whitespace-pre-wrap break-words text-slate-800">
                    {openZone.record?.notes?.trim() || "ไม่มี"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => setOpenZoneId(null)}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-700"
              >
                ปิด
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
