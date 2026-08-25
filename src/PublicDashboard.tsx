import React, { useMemo } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Map as MapIcon,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Upload,
  XCircle,
} from "lucide-react";

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

export type DashboardDestination =
  | "student"
  | "teacher"
  | "calendar"
  | "report";

type PublicDashboardProps = {
  inspections: PublicInspection[];
  zones: readonly PublicZone[];
  isLoading: boolean;
  error: string;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onNavigate?: (destination: DashboardDestination) => void;
  isAuthenticated?: boolean;
  canViewReports?: boolean;
};

type ZoneState = "approved" | "pending" | "failed" | "missing";

type ZoneSummary = PublicZone & {
  record?: PublicInspection;
  state: ZoneState;
};

const formatDateKey = (dateValue: string | Date): string => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getRecordRevision = (record: PublicInspection): number => {
  for (const value of [record.updatedAt, record.timestamp, record.createdAt]) {
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  const numericId = Number(record.id);
  if (Number.isFinite(numericId)) return numericId;

  const dateValue = new Date(record.date).getTime();
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
  onNavigate,
  isAuthenticated = false,
  canViewReports = false,
}: PublicDashboardProps) {
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
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.16em]">
                ภาพรวมข้อมูลสด
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
              สรุปภาพรวมวันนี้
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" /> {todayLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
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

      <div className="space-y-6 bg-slate-50/50 p-4 sm:p-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">ตรวจเสร็จแล้ว</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">
                  {dashboard.reviewed}
                  <span className="text-lg text-slate-400">/{zones.length} เขต</span>
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <ListChecks className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">คิดเป็น {completionRate}%</p>
          </article>

          <article className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">รออนุมัติ</p>
                <p className="mt-2 text-3xl font-black text-amber-500">
                  {dashboard.pending}
                  <span className="text-lg text-slate-400"> รายการ</span>
                </p>
                <p className="mt-3 text-xs text-slate-500">รอครูตรวจสอบผล</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-500">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">คะแนนเฉลี่ย</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">
                  {dashboard.average === null
                    ? "–"
                    : dashboard.average.toFixed(1)}
                  <span className="text-lg text-slate-400">/3</span>
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  จากรายการที่ตรวจแล้ว
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <Star className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">ไม่ผ่าน</p>
                <p className="mt-2 text-3xl font-black text-rose-500">
                  {dashboard.failed}
                  <span className="text-lg text-slate-400"> เขต</span>
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {dashboard.failed ? "ต้องดำเนินการปรับปรุง" : "ไม่พบรายการที่ต้องแก้ไข"}
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-500">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <MapIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800">สถานะพื้นที่ตรวจวันนี้</h3>
                  <p className="text-xs text-slate-500">
                    สถานะล่าสุดพร้อมสรุปสั้นของแต่ละเขตในจุดเดียว
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                ส่งแล้ว {zones.length - dashboard.missing}/{zones.length}
              </span>
            </div>

            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              <span className="font-black text-emerald-700">ภาพรวมวันนี้:</span>{" "}
              ตรวจเสร็จแล้ว {dashboard.reviewed} จาก {zones.length} เขต
              {dashboard.pending > 0 ? ` · รออนุมัติ ${dashboard.pending} เขต` : ""}
              {dashboard.failed > 0 ? ` · ไม่ผ่าน ${dashboard.failed} เขต` : ""}
              {dashboard.missing > 0 ? ` · ยังไม่บันทึก ${dashboard.missing} เขต` : ""}
              {dashboard.average !== null
                ? ` · คะแนนเฉลี่ย ${dashboard.average.toFixed(1)}/3`
                : ""}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.zoneSummaries.map((zone) => {
                const meta = stateMeta[zone.state];
                return (
                  <div
                    key={zone.id}
                    className={`rounded-2xl border p-4 transition-colors ${meta.cardClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.iconClass}`}
                      >
                        <StateIcon state={zone.state} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-black text-slate-800">
                            {zone.name}
                            {zone.class ? (
                              <span className="ml-1 text-xs font-medium text-slate-400">
                                ({zone.class})
                              </span>
                            ) : null}
                          </p>
                          <span className={`shrink-0 text-[11px] font-bold ${meta.textClass}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs font-bold ${meta.textClass}`}>
                          {zone.record && zone.state !== "pending"
                            ? `คะแนน ${Number(zone.record.score) || 0}/3`
                            : zone.state === "pending"
                              ? "รอตรวจสอบผล"
                              : "ยังไม่มีผลวันนี้"}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {getZonePublicSummary(zone)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
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

          <div className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-black text-slate-800">งานที่ต้องดำเนินการ</h3>
              </div>
              <div className="space-y-2.5">
                {dashboard.pending > 0 && (
                  <button
                    type="button"
                    disabled={!isAuthenticated || !onNavigate}
                    onClick={() => onNavigate?.("teacher")}
                    className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left disabled:cursor-default"
                  >
                    <Clock className="h-5 w-5 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">
                        รออนุมัติ {dashboard.pending} รายการ
                      </span>
                      <span className="block text-xs text-slate-500">
                        ครูผู้ดูแลตรวจสอบผล
                      </span>
                    </span>
                    {isAuthenticated && <ChevronRight className="h-4 w-4" />}
                  </button>
                )}

                {dashboard.failed > 0 && (
                  <button
                    type="button"
                    disabled={!isAuthenticated || !onNavigate}
                    onClick={() => onNavigate?.("teacher")}
                    className="flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-left disabled:cursor-default"
                  >
                    <XCircle className="h-5 w-5 shrink-0 text-rose-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">
                        ไม่ผ่าน {dashboard.failed} เขต
                      </span>
                      <span className="block text-xs text-slate-500">
                        ควรดำเนินการปรับปรุง
                      </span>
                    </span>
                    {isAuthenticated && <ChevronRight className="h-4 w-4" />}
                  </button>
                )}

                {dashboard.missing > 0 && (
                  <button
                    type="button"
                    disabled={!isAuthenticated || !onNavigate}
                    onClick={() => onNavigate?.("student")}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left disabled:cursor-default"
                  >
                    <Upload className="h-5 w-5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">
                        ยังไม่บันทึก {dashboard.missing} เขต
                      </span>
                      <span className="block text-xs text-slate-500">
                        ติดตามพื้นที่ที่ยังไม่มีข้อมูลวันนี้
                      </span>
                    </span>
                    {isAuthenticated && <ChevronRight className="h-4 w-4" />}
                  </button>
                )}

                {!dashboard.pending && !dashboard.failed && !dashboard.missing && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-4">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-800">
                      ดำเนินการครบทุกเขตแล้ว
                    </p>
                  </div>
                )}
              </div>

              {isAuthenticated && onNavigate ? (
                <div
                  className={`mt-4 grid grid-cols-1 gap-2 ${
                    canViewReports
                      ? "sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onNavigate("student")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    <Upload className="h-4 w-4" /> บันทึกผล
                  </button>
                  {canViewReports && (
                    <button
                      type="button"
                      onClick={() => onNavigate("report")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      <FileText className="h-4 w-4" /> ดูรายงาน
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-500">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  หน้าสาธารณะแสดงเฉพาะข้อมูลสรุป ไม่แสดงรูปหลักฐานหรือหมายเหตุ
                </div>
              )}
            </article>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          ระบบอัปเดตข้อมูลอัตโนมัติทุก 30 วินาทีจากฐานข้อมูลกลาง
        </p>
      </div>
    </section>
  );
}
