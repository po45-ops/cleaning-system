import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Shuffle,
  Unlock,
  Users,
  X,
} from "lucide-react";

type AuthUser = {
  id?: string;
  role?: string;
};

type CouncilGroup = {
  id: string;
  accountId: string;
  homeClass: string;
  homeZoneId: number;
  members: string[];
};

type WeekPeriod = {
  id: string;
  label: string;
  start: string;
  end: string;
};

type AssignmentByWeek = Record<string, Record<string, number>>;

type MonthlySchedule = {
  key: string;
  year: number;
  month: number;
  weeks: WeekPeriod[];
  assignments: AssignmentByWeek;
  groups: CouncilGroup[];
  published: boolean;
  updatedAt: string;
  shuffleNonce: number;
};

type ScheduleStore = Record<string, MonthlySchedule>;

type SyncNotice = {
  tone: "success" | "warning" | "info";
  text: string;
};

const STORAGE_KEY = "cleaning_council_schedule_v1";
const AUTH_KEY = "cleaning_auth_user";
const SCHEDULE_API_URL =
  "https://script.google.com/macros/s/AKfycbyTSx3ggaJfXtYd_rQ67FoI5pPb8y_LXcTAm6RiSnkf34uiZL5GZBStGVMXyGCHQ5JfEA/exec";

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const ZONES = [
  { id: 1, label: "เขต 1 ป.1" },
  { id: 2, label: "เขต 2 ป.2" },
  { id: 3, label: "เขต 3 ป.3" },
  { id: 4, label: "เขต 4 ป.4" },
  { id: 5, label: "เขต 5 ป.5" },
  { id: 6, label: "เขต 6 ป.6" },
  { id: 7, label: "เขต 7 ม.1" },
  { id: 8, label: "เขต 8 ม.2" },
  { id: 9, label: "เขต 9 ม.3" },
];

const DEFAULT_GROUPS: CouncilGroup[] = [
  {
    id: "group-m3",
    accountId: "สภา01",
    homeClass: "ม.3",
    homeZoneId: 9,
    members: ["จิราพร", "ธนวัฒน์"],
  },
  {
    id: "group-m2",
    accountId: "สภา02",
    homeClass: "ม.2",
    homeZoneId: 8,
    members: ["ศิริพงษ์", "ภาณุวัฒน์"],
  },
  {
    id: "group-p2",
    accountId: "สภา03",
    homeClass: "ป.2",
    homeZoneId: 2,
    members: ["พงศพัศ", "มงคลเทพ"],
  },
  {
    id: "group-p3",
    accountId: "สภา04",
    homeClass: "ป.3",
    homeZoneId: 3,
    members: ["วรัชญา", "มหายศนันท์"],
  },
  {
    id: "group-p1",
    accountId: "สภา05",
    homeClass: "ป.1",
    homeZoneId: 1,
    members: ["อรพิมพ์", "อโณทัย"],
  },
  {
    id: "group-p5",
    accountId: "สภา06",
    homeClass: "ป.5",
    homeZoneId: 5,
    members: ["เอเชีย", "ภูผา"],
  },
  {
    id: "group-p4",
    accountId: "สภา07",
    homeClass: "ป.4",
    homeZoneId: 4,
    members: ["ศุภกร", "ชนวีร์", "จารุวัฒน์"],
  },
  {
    id: "group-p6",
    accountId: "สภา08",
    homeClass: "ป.6",
    homeZoneId: 6,
    members: ["วีรัช", "วุฒิชัย"],
  },
  {
    id: "group-m1",
    accountId: "สภา09",
    homeClass: "ม.1",
    homeZoneId: 7,
    members: ["นพวิทย์", "อนุวัฒน์"],
  },
];

const pad2 = (value: number): string => String(value).padStart(2, "0");

const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseDateKey = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const formatThaiDate = (value: string): string => {
  const date = parseDateKey(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
};

const scheduleKey = (year: number, month: number): string =>
  `${year}-${pad2(month + 1)}`;

const addDays = (date: Date, amount: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  result.setHours(12, 0, 0, 0);
  return result;
};

const getMonthWeeks = (year: number, month: number): WeekPeriod[] => {
  const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  let monday = addDays(firstDay, -mondayOffset);
  const weeks: WeekPeriod[] = [];
  let index = 1;

  while (monday <= lastDay) {
    const friday = addDays(monday, 4);
    if (friday >= firstDay) {
      const start = formatDateKey(monday);
      const end = formatDateKey(friday);
      weeks.push({
        id: `week-${index}-${start}`,
        label: `สัปดาห์ที่ ${index}`,
        start,
        end,
      });
      index += 1;
    }
    monday = addDays(monday, 7);
  }

  return weeks;
};

const hashSeed = (input: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seed: number): (() => number) => {
  let state = seed || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T,>(items: T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const generateAssignments = (
  groups: CouncilGroup[],
  weeks: WeekPeriod[],
  year: number,
  month: number,
  nonce: number,
  previousLastWeek?: Record<string, number>
): AssignmentByWeek => {
  const seed = hashSeed(`${year}-${month}-${nonce}-council-fairness`);
  const random = createRandom(seed);
  const steps = [1, 2, 4, 5, 7, 8];
  let groupRanks: number[] = [];
  let baseOffset = 0;
  let step = 1;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    groupRanks = shuffle(
      groups.map((_, index) => index),
      random
    );
    baseOffset = Math.floor(random() * 9);
    step = steps[Math.floor(random() * steps.length)];

    const firstWeekZones = groups.map(
      (_, groupIndex) => ((groupRanks[groupIndex] + baseOffset) % 9) + 1
    );
    const avoidsHomeZones = groups.every(
      (group, groupIndex) => firstWeekZones[groupIndex] !== group.homeZoneId
    );
    const avoidsPreviousWeek = groups.every((group, groupIndex) => {
      if (!previousLastWeek) return true;
      return previousLastWeek[group.id] !== firstWeekZones[groupIndex];
    });

    if (avoidsHomeZones && avoidsPreviousWeek) break;
  }

  const assignments: AssignmentByWeek = {};
  weeks.forEach((week, weekIndex) => {
    assignments[week.id] = {};
    groups.forEach((group, groupIndex) => {
      assignments[week.id][group.id] =
        ((groupRanks[groupIndex] + baseOffset + weekIndex * step) % 9) + 1;
    });
  });

  return assignments;
};

const cloneGroups = (groups: CouncilGroup[]): CouncilGroup[] =>
  groups.map((group) => ({ ...group, members: [...group.members] }));

const readStore = (): ScheduleStore => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved) as ScheduleStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const findPreviousSchedule = (
  store: ScheduleStore,
  year: number,
  month: number
): MonthlySchedule | undefined => {
  const previousDate = new Date(year, month - 1, 1, 12, 0, 0, 0);
  return store[scheduleKey(previousDate.getFullYear(), previousDate.getMonth())];
};

const getLastWeekAssignments = (
  schedule?: MonthlySchedule
): Record<string, number> | undefined => {
  if (!schedule || schedule.weeks.length === 0) return undefined;
  const lastWeek = schedule.weeks[schedule.weeks.length - 1];
  return schedule.assignments[lastWeek.id];
};

const createSchedule = (
  year: number,
  month: number,
  groups: CouncilGroup[],
  nonce: number,
  store: ScheduleStore
): MonthlySchedule => {
  const weeks = getMonthWeeks(year, month);
  const previousSchedule = findPreviousSchedule(store, year, month);
  return {
    key: scheduleKey(year, month),
    year,
    month,
    weeks,
    assignments: generateAssignments(
      groups,
      weeks,
      year,
      month,
      nonce,
      getLastWeekAssignments(previousSchedule)
    ),
    groups: cloneGroups(groups),
    published: false,
    updatedAt: new Date().toISOString(),
    shuffleNonce: nonce,
  };
};

const getAuthUser = (): AuthUser | null => {
  try {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? (JSON.parse(saved) as AuthUser) : null;
  } catch {
    return null;
  }
};

const zoneLabel = (zoneId?: number): string =>
  ZONES.find((zone) => zone.id === zoneId)?.label || "ยังไม่จัดเขต";

const getCurrentWeek = (weeks: WeekPeriod[]): WeekPeriod | undefined => {
  const today = formatDateKey(new Date());
  return weeks.find((week) => today >= week.start && today <= week.end);
};

const noticeClassName = (tone: SyncNotice["tone"]): string => {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
};

const syncScheduleToBackend = async (schedule: MonthlySchedule): Promise<void> => {
  const response = await fetch(SCHEDULE_API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "saveCouncilSchedule",
      schedule,
    }),
  });
  const result = (await response.json()) as {
    status?: string;
    message?: string;
  };
  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || `HTTP ${response.status}`);
  }
};
export default function CouncilScheduleWidget(): React.ReactElement | null {
  const now = new Date();
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getAuthUser());
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [store, setStore] = useState<ScheduleStore>(() => readStore());
  const [schedule, setSchedule] = useState<MonthlySchedule>(() => {
    const savedStore = readStore();
    const key = scheduleKey(now.getFullYear(), now.getMonth());
    return (
      savedStore[key] ||
      createSchedule(
        now.getFullYear(),
        now.getMonth(),
        cloneGroups(DEFAULT_GROUPS),
        0,
        savedStore
      )
    );
  });
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const isAdmin = authUser?.role === "admin";

  useEffect(() => {
    const syncAuth = () => {
      const nextUser = getAuthUser();
      setAuthUser((current) => {
        const currentValue = JSON.stringify(current);
        const nextValue = JSON.stringify(nextUser);
        return currentValue === nextValue ? current : nextUser;
      });
      if (!nextUser) setIsOpen(false);
    };

    syncAuth();
    const intervalId = window.setInterval(syncAuth, 600);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  useEffect(() => {
    const key = scheduleKey(selectedYear, selectedMonth);
    const freshStore = readStore();
    setStore(freshStore);
    setSchedule(
      freshStore[key] ||
        createSchedule(
          selectedYear,
          selectedMonth,
          cloneGroups(DEFAULT_GROUPS),
          0,
          freshStore
        )
    );
    setIsEditingGroups(false);
    setNotice(null);
  }, [selectedYear, selectedMonth]);

  const currentUserGroup = useMemo(() => {
    const userId = String(authUser?.id || "").trim();
    if (!userId) return undefined;
    return schedule.groups.find(
      (group) => group.accountId.trim().toLowerCase() === userId.toLowerCase()
    );
  }, [authUser?.id, schedule.groups]);

  const currentWeek = useMemo(
    () => getCurrentWeek(schedule.weeks),
    [schedule.weeks]
  );

  const currentAssignment =
    currentWeek && currentUserGroup
      ? schedule.assignments[currentWeek.id]?.[currentUserGroup.id]
      : undefined;

  const goToPreviousMonth = () => {
    const date = new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0, 0);
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth());
  };

  const goToNextMonth = () => {
    const date = new Date(selectedYear, selectedMonth + 1, 1, 12, 0, 0, 0);
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth());
  };

  const saveSchedule = async (
    nextSchedule: MonthlySchedule,
    message: string
  ): Promise<void> => {
    const updatedSchedule = {
      ...nextSchedule,
      updatedAt: new Date().toISOString(),
      groups: cloneGroups(nextSchedule.groups),
    };
    const nextStore = { ...readStore(), [updatedSchedule.key]: updatedSchedule };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
    setStore(nextStore);
    setSchedule(updatedSchedule);
    window.dispatchEvent(new Event("council-schedule-updated"));
    setNotice({
      tone: "info",
      text: `${message} กำลังซิงก์ข้อมูลผู้รับผิดชอบไปยังระบบแจ้งเตือน...`,
    });

    try {
      await syncScheduleToBackend(updatedSchedule);
      setNotice({
        tone: "success",
        text: `${message} และซิงก์รายชื่อผู้รับผิดชอบไปยังระบบแจ้งเตือนแล้ว`,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อได้";
      setNotice({
        tone: "warning",
        text: `บันทึกในเครื่องแล้ว แต่ซิงก์ระบบแจ้งเตือนไม่สำเร็จ: ${reason}`,
      });
    }
  };

  const randomizeSchedule = () => {
    if (!isAdmin) return;
    const nonce = schedule.shuffleNonce + 1;
    const randomized = createSchedule(
      selectedYear,
      selectedMonth,
      schedule.groups,
      nonce,
      store
    );
    randomized.published = false;
    setSchedule(randomized);
    setNotice({
      tone: "info",
      text: "จัดเวรชุดใหม่แล้ว กรุณาตรวจสอบก่อนกดบันทึกหรือเผยแพร่",
    });
  };

  const resetSchedule = () => {
    if (!isAdmin) return;
    const reset = createSchedule(
      selectedYear,
      selectedMonth,
      cloneGroups(DEFAULT_GROUPS),
      0,
      store
    );
    setSchedule(reset);
    setNotice({
      tone: "warning",
      text: "คืนค่ารายชื่อและตารางเริ่มต้นแล้ว กรุณากดบันทึกเพื่อยืนยัน",
    });
  };

  const togglePublished = () => {
    if (!isAdmin) return;
    const next = { ...schedule, published: !schedule.published };
    void saveSchedule(
      next,
      next.published
        ? "เผยแพร่ตารางแล้ว สภานักเรียนสามารถเปิดดูตารางฉบับนี้ได้"
        : "ยกเลิกการเผยแพร่แล้ว ตารางกลับเป็นฉบับร่าง"
    );
  };

  const changeAssignment = (weekId: string, groupId: string, zoneId: number) => {
    if (!isAdmin) return;
    const currentWeekAssignments = {
      ...(schedule.assignments[weekId] || {}),
    };
    const oldZone = currentWeekAssignments[groupId];
    const otherGroupId = Object.keys(currentWeekAssignments).find(
      (candidateId) =>
        candidateId !== groupId && currentWeekAssignments[candidateId] === zoneId
    );

    currentWeekAssignments[groupId] = zoneId;
    if (otherGroupId && oldZone) {
      currentWeekAssignments[otherGroupId] = oldZone;
    }

    setSchedule({
      ...schedule,
      published: false,
      assignments: {
        ...schedule.assignments,
        [weekId]: currentWeekAssignments,
      },
    });
    setNotice({
      tone: "info",
      text: otherGroupId
        ? "ระบบสลับเขตให้อีกกลุ่มโดยอัตโนมัติ เพื่อให้หนึ่งเขตมีผู้ตรวจเพียงหนึ่งกลุ่ม"
        : "แก้ไขผู้ตรวจแล้ว กรุณากดบันทึก",
    });
  };

  const updateGroup = (groupId: string, patch: Partial<CouncilGroup>) => {
    if (!isAdmin) return;
    setSchedule({
      ...schedule,
      published: false,
      groups: schedule.groups.map((group) =>
        group.id === groupId ? { ...group, ...patch } : group
      ),
    });
  };

  if (!authUser) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-[70] flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-indigo-700 md:bottom-6 md:right-6 print:hidden"
        aria-label="เปิดตารางจัดเวรตรวจ"
      >
        <CalendarDays className="h-5 w-5" />
        <span className="hidden sm:inline">ตารางจัดเวรตรวจ</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm md:p-6 print:hidden">
          <div className="mx-auto min-h-[calc(100vh-1rem)] max-w-[1500px] overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:min-h-0">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-white px-4 py-3 md:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 md:text-2xl">
                    ระบบจัดเวรสภานักเรียนตรวจความสะอาด
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      isAdmin
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {isAdmin ? "แอดมินแก้ไขได้" : "สภานักเรียนดูอย่างเดียว"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  หมุนเวียนผู้ตรวจแบบสมดุล ไม่ให้กลุ่มเดิมตรวจเขตเดิมซ้ำติดต่อกัน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="ปิด"
              >
                <X className="h-6 w-6" />
              </button>
            </header>

            <main className="space-y-4 p-3 md:p-6">
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center justify-center gap-2 xl:justify-start">
                    <button
                      type="button"
                      onClick={goToPreviousMonth}
                      className="rounded-xl border p-2 text-slate-600 transition hover:bg-slate-50"
                      aria-label="เดือนก่อนหน้า"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-[230px] text-center">
                      <div className="text-xl font-black text-slate-900">
                        {MONTHS[selectedMonth]} {selectedYear + 543}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {schedule.weeks.length} รอบตรวจประจำเดือน
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={goToNextMonth}
                      className="rounded-xl border p-2 text-slate-600 transition hover:bg-slate-50"
                      aria-label="เดือนถัดไป"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-end">
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                        schedule.published
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {schedule.published ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                      {schedule.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                    </span>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={randomizeSchedule}
                          className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          <Shuffle className="h-4 w-4" /> สุ่มจัดใหม่
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingGroups((value) => !value)}
                          className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                        >
                          <Edit3 className="h-4 w-4" /> แก้รายชื่อกลุ่ม
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveSchedule(schedule, "บันทึกตารางจัดเวรเรียบร้อยแล้ว")
                          }
                          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                        >
                          <Save className="h-4 w-4" /> บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={togglePublished}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white transition ${
                            schedule.published
                              ? "bg-amber-500 hover:bg-amber-600"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {schedule.published ? (
                            <Unlock className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          {schedule.published ? "กลับเป็นฉบับร่าง" : "เผยแพร่ตาราง"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {notice && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${noticeClassName(
                    notice.tone
                  )}`}
                >
                  {notice.text}
                </div>
              )}

              {!isAdmin && currentUserGroup && (
                <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-indigo-700">หน้าที่ของกลุ่มคุณ</p>
                      <h3 className="mt-1 text-xl font-black text-slate-900">
                        กลุ่ม {currentUserGroup.homeClass}: {currentUserGroup.members.join(" • ")}
                      </h3>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                      {currentWeek ? (
                        <>
                          <div className="text-xs font-bold text-slate-500">
                            {currentWeek.label} · {formatThaiDate(currentWeek.start)} – {formatThaiDate(currentWeek.end)}
                          </div>
                          <div className="mt-1 text-lg font-black text-indigo-700">
                            ตรวจ {zoneLabel(currentAssignment)}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm font-bold text-slate-600">
                          วันนี้อยู่นอกช่วงสัปดาห์ตรวจของเดือนที่เลือก
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {!isAdmin && !currentUserGroup && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  บัญชี <strong>{authUser.id || "ไม่ระบุ"}</strong> ยังไม่ได้ผูกกับกลุ่มในตาราง
                  กรุณาให้แอดมินแก้ช่อง “บัญชีเข้าสู่ระบบ” ให้ตรงกับบัญชีนี้
                </div>
              )}

              {isAdmin && isEditingGroups && (
                <section className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                        <Users className="h-5 w-5 text-indigo-600" /> รายชื่อกลุ่มสภานักเรียน
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        แก้บัญชี ชั้นประจำกลุ่ม และรายชื่อสมาชิกได้ รายชื่อหลายคนให้คั่นด้วยเครื่องหมายจุลภาค
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetSchedule}
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      <RotateCcw className="h-4 w-4" /> คืนค่าเริ่มต้น
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {schedule.groups.map((group, index) => (
                      <div key={group.id} className="rounded-xl border bg-slate-50 p-3">
                        <div className="mb-2 text-sm font-black text-slate-700">
                          กลุ่มที่ {index + 1}
                        </div>
                        <label className="block text-xs font-bold text-slate-500">
                          บัญชีเข้าสู่ระบบ
                          <input
                            value={group.accountId}
                            onChange={(event) =>
                              updateGroup(group.id, { accountId: event.target.value })
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        </label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="block text-xs font-bold text-slate-500">
                            ชั้นประจำกลุ่ม
                            <input
                              value={group.homeClass}
                              onChange={(event) =>
                                updateGroup(group.id, { homeClass: event.target.value })
                              }
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                          </label>
                          <label className="block text-xs font-bold text-slate-500">
                            เขตเดิม
                            <select
                              value={group.homeZoneId}
                              onChange={(event) =>
                                updateGroup(group.id, {
                                  homeZoneId: Number(event.target.value),
                                })
                              }
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                              {ZONES.map((zone) => (
                                <option key={zone.id} value={zone.id}>
                                  {zone.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="mt-2 block text-xs font-bold text-slate-500">
                          สมาชิกในกลุ่ม
                          <input
                            value={group.members.join(", ")}
                            onChange={(event) =>
                              updateGroup(group.id, {
                                members: event.target.value
                                  .split(",")
                                  .map((name) => name.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-black text-slate-900">ตารางหมุนเวียนประจำเดือน</h3>
                    <p className="text-xs text-slate-500">
                      ทุกสัปดาห์ใช้ครบ 9 เขต และแต่ละกลุ่มไม่ตรวจเขตซ้ำภายในเดือนเดียวกัน
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5" />
                    ปรับปรุงล่าสุด {new Date(schedule.updatedAt).toLocaleString("th-TH")}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1050px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="sticky left-0 z-10 min-w-[240px] border-b border-r bg-slate-100 px-3 py-3 text-left font-black">
                          กลุ่มผู้ตรวจ
                        </th>
                        {schedule.weeks.map((week) => (
                          <th key={week.id} className="min-w-[155px] border-b border-r px-3 py-3 text-center font-black">
                            <div>{week.label}</div>
                            <div className="mt-1 text-[11px] font-semibold text-slate-500">
                              {formatThaiDate(week.start)}
                              <br />– {formatThaiDate(week.end)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.groups.map((group, groupIndex) => {
                        const isOwnGroup = currentUserGroup?.id === group.id;
                        return (
                          <tr
                            key={group.id}
                            className={`${
                              isOwnGroup ? "bg-indigo-50" : groupIndex % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                            }`}
                          >
                            <td
                              className={`sticky left-0 z-10 border-b border-r px-3 py-3 align-middle ${
                                isOwnGroup
                                  ? "bg-indigo-100"
                                  : groupIndex % 2 === 1
                                  ? "bg-slate-50"
                                  : "bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-black text-slate-900">
                                    กลุ่ม {group.homeClass}
                                    {isOwnGroup && (
                                      <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] text-white">
                                        กลุ่มของคุณ
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs leading-relaxed text-slate-600">
                                    {group.members.length > 0
                                      ? group.members.join(" • ")
                                      : "ยังไม่มีรายชื่อสมาชิก"}
                                  </div>
                                  <div className="mt-1 text-[10px] font-bold text-slate-400">
                                    บัญชี: {group.accountId || "ยังไม่กำหนด"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {schedule.weeks.map((week) => {
                              const assignedZone = schedule.assignments[week.id]?.[group.id];
                              return (
                                <td key={week.id} className="border-b border-r px-2 py-3 text-center align-middle">
                                  {isAdmin ? (
                                    <select
                                      value={assignedZone || ""}
                                      onChange={(event) =>
                                        changeAssignment(
                                          week.id,
                                          group.id,
                                          Number(event.target.value)
                                        )
                                      }
                                      className="w-full rounded-lg border bg-white px-2 py-2 text-center font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    >
                                      {ZONES.map((zone) => (
                                        <option key={zone.id} value={zone.id}>
                                          {zone.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="inline-flex min-w-[115px] justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 font-black text-slate-700 shadow-sm">
                                      {zoneLabel(assignedZone)}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-black text-slate-900">หลักความยุติธรรม</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    แต่ละสัปดาห์ทุกเขตมีผู้ตรวจเพียงหนึ่งกลุ่ม และผู้ตรวจจะหมุนเวียนไปยังเขตใหม่
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-black text-slate-900">การแก้ตาราง</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    เมื่อแอดมินเลือกเขตที่มีคนตรวจอยู่แล้ว ระบบจะสลับสองกลุ่มให้อัตโนมัติ ไม่ทำให้เขตซ้ำ
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-black text-slate-900">สิทธิ์การใช้งาน</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    แอดมินสุ่ม แก้ไข บันทึก และเผยแพร่ได้ ส่วนบัญชีสภานักเรียนเปิดดูได้อย่างเดียว
                  </p>
                </div>
              </section>
            </main>
          </div>
        </div>
      )}
    </>
  );
}
