import React, { useState, useEffect, useRef } from "react";
import type { WorkSheet } from "xlsx-js-style";
import {
  getAcademicWeekNumber,
  isAcademicWeekInTerm,
} from "./report-utils";
import {
  createPasswordVerifier,
  verifyPassword,
  type PasswordVerifier,
} from "./password-utils";
import {
  COUNCIL_ACCOUNT_IDS,
  getDefaultStudentCredentials,
  type StudentCredential,
} from "./student-credentials";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  Camera,
  CheckCircle,
  FileSpreadsheet,
  Printer,
  Clock,
  XCircle,
  AlertCircle,
  Upload,
  FileText,
  UserCheck,
  Users,
  CalendarDays,
  BarChart3,
  LogOut,
  Key,
  Shield,
  Lock,
  Trash2,
  UserPlus,
  Edit,
  Save,
  TableProperties,
  Sparkles,
  Home,
  LogIn,
} from "lucide-react";
import PublicDashboard, {
  type DashboardDestination,
} from "./PublicDashboard";

type InspectionStatus = "pending" | "approved" | "rejected";

type InspectionRecord = {
  id: string | number;
  date: string;
  zoneId: string | number;
  score: string | number | null;
  notes: string;
  status: InspectionStatus;
  images: string[];
  updatedAt?: string;
  timestamp?: string;
  createdAt?: string;
};

type InspectionInput = Partial<Pick<InspectionRecord, "id" | "notes" | "status" | "images">> & {
  date: string;
  zoneId: string | number;
  score: string | number;
};

type AuthUser = {
  role: "admin" | "student";
  id?: string;
};

type ApiResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

type AppTab =
  | "overview"
  | "student"
  | "teacher"
  | "calendar"
  | "report"
  | "users";

type LoginMode = "student" | "admin";

type LoginScreenProps = {
  onLogin: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  onBack: () => void;
  schoolLogo: string;
  studentCredentials: StudentCredential[];
  adminCredential: PasswordVerifier | null;
  setAdminCredential: React.Dispatch<
    React.SetStateAction<PasswordVerifier | null>
  >;
};

type StudentFormState = {
  date: string;
  zoneId: string;
  score: number | null;
  notes: string;
};

type StudentFormProps = {
  onSave: (data: InspectionRecord) => void;
  inspections: InspectionRecord[];
};

type CalendarStatus = "complete" | "partial" | "missing" | "future" | "weekend";

type CalendarDayInfo = {
  key: string;
  status: CalendarStatus;
  records: InspectionRecord[];
  checkedCount: number;
  isWeekend: boolean;
  isFuture: boolean;
};

type TeacherApprovalProps = {
  inspections: InspectionRecord[];
  updateStatus: (
    id: InspectionRecord["id"],
    status: InspectionStatus
  ) => Promise<boolean>;
  updateInspection: (item: InspectionRecord) => Promise<boolean>;
  deleteInspection: (id: InspectionRecord["id"]) => Promise<boolean>;
  userRole: AuthUser["role"];
};

type ReportSettings = {
  president: string;
  teacher: string;
  director: string;
  headStudentAffairs: string;
  term: string;
  year: string;
  semesterStart: string;
};

type ReportViewProps = {
  inspections: InspectionRecord[];
  schoolLogo: string;
  setSchoolLogo: React.Dispatch<React.SetStateAction<string>>;
  updateInspection: (item: InspectionRecord) => Promise<boolean>;
  createInspection: (item: InspectionInput) => Promise<InspectionRecord | false>;
};

type UserManagementProps = {
  credentials: StudentCredential[];
  setCredentials: React.Dispatch<React.SetStateAction<StudentCredential[]>>;
  adminCredential: PasswordVerifier | null;
  setAdminCredential: React.Dispatch<
    React.SetStateAction<PasswordVerifier | null>
  >;
};

type SpreadsheetRow = Array<string | number>;
type SpreadsheetWorksheet = WorkSheet;
type SpreadsheetStyleOptions = {
  titleRows?: number[];
  headerRows?: number[];
  tableStartRow?: number;
  totalRows?: number[];
};
type WordAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

// === URL ฐานข้อมูล Google Sheets ของคุณ ===
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwfmqSlIqJ0-2CoAQ1Uv7nrL47x3zsqToUWP0brNiHBnJGFIvz450w33ANBmltvOjNPTg/exec";
const STUDENT_CREDENTIALS_KEY = "cleaning_student_credentials_v3";
const ADMIN_CREDENTIAL_KEY = "cleaning_admin_credential_v2";
const MIN_ADMIN_PASSWORD_LENGTH = 6;
const LEGACY_PLAINTEXT_CREDENTIALS_KEY = "cleaning_student_creds";
const LEGACY_SEED_KEY = "cleaning_student_creds_seed_9_groups_v1";
const PREVIOUS_HASHED_CREDENTIALS_KEY = "cleaning_student_credentials_v2";
const LEGACY_CREDENTIAL_KEYS = [
  LEGACY_PLAINTEXT_CREDENTIALS_KEY,
  LEGACY_SEED_KEY,
  PREVIOUS_HASHED_CREDENTIALS_KEY,
];

// --- ข้อมูลพื้นฐาน ---
const ZONES = [
  {
    id: 1,
    name: "เขต 1",
    class: "ป.1",
    fullClass: "ชั้นประถมศึกษาปีที่ 1",
    desc: "รอบอาคารเรียนของ ป.1, ป.6 และ ม.1 ทางเดินลงไปอาคารอเนกประสงค์ (หน้าห้อง ป.1)",
  },
  {
    id: 2,
    name: "เขต 2",
    class: "ป.2",
    fullClass: "ชั้นประถมศึกษาปีที่ 2",
    desc: "รอบอาคาร ป.2, ป.3 รวมถึงบริเวณทางเดินถึงสหกรณ์ และโรงจอดรถข้างสหกรณ์",
  },
  {
    id: 3,
    name: "เขต 3",
    class: "ป.3",
    fullClass: "ชั้นประถมศึกษาปีที่ 3",
    desc: "ถนนทางเข้าโรงเรียน ต่อเนื่องจนถึงก่อนบริเวณโรงจอดรถหน้าโรงอาหาร",
  },
  {
    id: 4,
    name: "เขต 4",
    class: "ป.4",
    fullClass: "ชั้นประถมศึกษาปีที่ 4",
    desc: "หน้าอาคารห้องวิชาการ, ห้องคณิตศาสตร์ (ครูพงศกร), ห้อง ป.4 (บริเวณสนามหญ้าและจุดเช็คอิน)",
  },
  {
    id: 5,
    name: "เขต 5",
    class: "ป.5",
    fullClass: "ชั้นประถมศึกษาปีที่ 5",
    desc: "สนามหญ้าโรงเรียน, อาคารอเนกประสงค์ และห้องน้ำข้างห้อง ม.1",
  },
  {
    id: 6,
    name: "เขต 6",
    class: "ป.6",
    fullClass: "ชั้นประถมศึกษาปีที่ 6",
    desc: "สนามวอลเลย์บอลหน้าเสาธง, รอบอาคาร USO Net และศาลาพัก ข้างสนามวอลเลย์บอล ทางเดินลงอาคารอเนกประสงค์ (หน้าห้อง ม.3)",
  },
  {
    id: 7,
    name: "เขต 7",
    class: "ม.1",
    fullClass: "ชั้นมัธยมศึกษาปีที่ 1",
    desc: "โรงซักล้าง, โรงอาหาร, ที่จอดรถหน้าโรงอาหาร และห้องน้ำลอยฟ้า",
  },
  {
    id: 8,
    name: "เขต 8",
    class: "ม.2",
    fullClass: "ชั้นมัธยมศึกษาปีที่ 2",
    desc: "หลังอาคารห้องวิชาการ, ห้องคณิตศาสตร์ (ครูพงศกร), ห้อง ป.4 และบริเวณอาคารห้องครูไอวาลิญ, ห้อง ม.2 และห้องครูนิรุจน์",
  },
  {
    id: 9,
    name: "เขต 9",
    class: "ม.3",
    fullClass: "ชั้นมัธยมศึกษาปีที่ 3",
    desc: "รอบอาคาร ป.5, อาคาร ม.3, ห้องน้ำ ป.1 และห้องน้ำหลังห้อง ม.3",
  },
];

const RUBRIC = [
  {
    score: 3,
    label: "ดีมาก",
    color: "bg-green-100 border-green-500 text-green-700",
    desc: "พื้นสะอาดไม่มีขยะ/ฝุ่น, ถังขยะถูกเท, อุปกรณ์เป็นระเบียบ, นักเรียนมาครบ",
  },
  {
    score: 2,
    label: "พอใช้",
    color: "bg-blue-100 border-blue-500 text-blue-700",
    desc: "พื้นสะอาดแต่มีฝุ่นเล็กน้อย, อุปกรณ์ไม่เป็นระเบียบเล็กน้อย, ขาดบางคน",
  },
  {
    score: 1,
    label: "ปรับปรุง",
    color: "bg-yellow-100 border-yellow-500 text-yellow-700",
    desc: "พื้นสกปรก มีขยะ, ไม่เทถังขยะ, อุปกรณ์กระจัดกระจาย, มาทำเวรน้อย",
  },
  {
    score: 0,
    label: "ไม่ผ่าน",
    color: "bg-red-100 border-red-500 text-red-700",
    desc: "ไม่มีการทำความสะอาดเลย หรือไม่มีนักเรียนมาปฏิบัติหน้าที่",
  },
];

const getDefaultWeekday = () => {
  const d = new Date();
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1);
  if (day === 0) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatThaiDateShort = (dateStr: string | Date) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = [
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
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
};

// 🚀 ฟังก์ชันเสริมเพื่อเคลียร์ Timezone และแปลงวันที่ใน Sheet ให้เป็น YYYY-MM-DD เป๊ะๆ
const formatDateKey = (dateStr: string | Date) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getInspectionRevisionTimestamp = (item: InspectionRecord): number => {
  for (const value of [item.updatedAt, item.timestamp, item.createdAt]) {
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  const numericId = Number(item.id);
  if (Number.isFinite(numericId)) return numericId;

  const dateValue = new Date(item.date).getTime();
  return Number.isFinite(dateValue) ? dateValue : 0;
};

// หากเขตเดิมส่งซ้ำในวันเดียวกัน ใช้ revision ล่าสุดเป็นข้อมูลหลักเสมอ
const pickLatestInspection = (
  current: InspectionRecord | undefined,
  candidate: InspectionRecord
): InspectionRecord => {
  if (!current) return candidate;
  return getInspectionRevisionTimestamp(candidate) >=
    getInspectionRevisionTimestamp(current)
    ? candidate
    : current;
};

// ป้องกันข้อมูลซ้ำทั้งกรณี ID ซ้ำ และกรณีเขตเดิมถูกส่งซ้ำในวันเดียวกัน
const deduplicateInspections = (
  items: InspectionRecord[]
): InspectionRecord[] => {
  const recordsById = new Map<string, InspectionRecord>();

  items.forEach((item, index) => {
    const id = String(item.id || "").trim();
    const key = id ? `id:${id}` : `row:${index}`;
    recordsById.set(key, pickLatestInspection(recordsById.get(key), item));
  });

  const recordsByDateAndZone = new Map<string, InspectionRecord>();
  Array.from(recordsById.values()).forEach((item, index) => {
    const date = formatDateKey(item.date);
    const zoneId = Number(item.zoneId);
    const key = date && zoneId ? `${date}|${zoneId}` : `record:${index}`;
    recordsByDateAndZone.set(
      key,
      pickLatestInspection(recordsByDateAndZone.get(key), item)
    );
  });

  return Array.from(recordsByDateAndZone.values());
};

const compressImage = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    if (!String(file.type || "").startsWith("image/")) {
      reject(new Error("รองรับเฉพาะไฟล์รูปภาพ"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("เปิดไฟล์รูปภาพไม่สำเร็จ"));
      img.src = String(event.target?.result || "");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("ประมวลผลรูปภาพไม่สำเร็จ"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.6);
        resolve(compressedDataUrl);
      };
    };
    reader.readAsDataURL(file);
  });
};

const isInspectionRecord = (value: unknown): value is InspectionRecord => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<InspectionRecord>;
  return (
    (typeof item.id === "string" || typeof item.id === "number") &&
    typeof item.date === "string" &&
    (typeof item.zoneId === "string" || typeof item.zoneId === "number") &&
    ["pending", "approved", "rejected"].includes(String(item.status)) &&
    Array.isArray(item.images)
  );
};

const readStoredAuthUser = (): AuthUser | null => {
  try {
    const saved = JSON.parse(
      localStorage.getItem("cleaning_auth_user") || "null"
    ) as Partial<AuthUser> | null;
    if (!saved || (saved.role !== "admin" && saved.role !== "student")) {
      return null;
    }
    return {
      role: saved.role,
      id: typeof saved.id === "string" ? saved.id : undefined,
    };
  } catch {
    return null;
  }
};

const parseStudentCredentials = (
  saved: string | null
): StudentCredential[] | null => {
  if (saved === null) return null;
  try {
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is StudentCredential =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as StudentCredential).id === "string" &&
        COUNCIL_ACCOUNT_IDS.includes((item as StudentCredential).id) &&
        typeof (item as StudentCredential).salt === "string" &&
        typeof (item as StudentCredential).passwordHash === "string"
    );
  } catch {
    return null;
  }
};

const readStoredCredentials = (): StudentCredential[] | null =>
  parseStudentCredentials(localStorage.getItem(STUDENT_CREDENTIALS_KEY));

const readLegacyPlaintextCredentials = (): Array<{
  id: string;
  password: string;
}> | null => {
  const saved = localStorage.getItem(LEGACY_PLAINTEXT_CREDENTIALS_KEY);
  if (saved === null) return null;
  try {
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (item): item is { id: string; password: string } =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as { id?: unknown }).id === "string" &&
          typeof (item as { password?: unknown }).password === "string"
      )
      .map((item) => ({ id: item.id.trim(), password: item.password }))
      .filter((item) => COUNCIL_ACCOUNT_IDS.includes(item.id));
  } catch {
    return null;
  }
};

const readStoredAdminCredential = (): PasswordVerifier | null => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(ADMIN_CREDENTIAL_KEY) || "null"
    ) as Partial<PasswordVerifier> | null;
    return parsed &&
      typeof parsed.salt === "string" &&
      typeof parsed.passwordHash === "string"
      ? { salt: parsed.salt, passwordHash: parsed.passwordHash }
      : null;
  } catch {
    return null;
  }
};

const prepareSchoolLogo = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("กรุณาเลือกไฟล์รูปภาพ"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("เปิดไฟล์รูปภาพไม่สำเร็จ"));
      img.onload = () => {
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("เตรียมรูปภาพไม่สำเร็จ"));
          return;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(event.target?.result || "");
    };
    reader.readAsDataURL(file);
  });
};

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(readStoredAuthUser);

  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [showLogin, setShowLogin] = useState(false);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem("cleaning_auth_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("cleaning_auth_user");
      setActiveTab("overview");
    }
  }, [user]);

  const [schoolLogo, setSchoolLogo] = useState<string>(() => {
    return localStorage.getItem("cleaning_school_logo") || "";
  });

  useEffect(() => {
    localStorage.setItem("cleaning_school_logo", schoolLogo);
  }, [schoolLogo]);

  const handleSchoolLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setSchoolLogo(await prepareSchoolLogo(file));
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "เพิ่มรูปส่วนหัวไม่สำเร็จ"
      );
    }
  };

  const shouldMigrateLegacyCredentials = useRef(
    localStorage.getItem(STUDENT_CREDENTIALS_KEY) === null &&
      (localStorage.getItem(LEGACY_PLAINTEXT_CREDENTIALS_KEY) !== null ||
        localStorage.getItem(PREVIOUS_HASHED_CREDENTIALS_KEY) !== null)
  );
  const legacyCredentialMigration = useRef<
    Promise<StudentCredential[] | null> | null
  >(null);
  const [studentCredentials, setStudentCredentials] = useState<
    StudentCredential[]
  >(() => readStoredCredentials() ?? getDefaultStudentCredentials());
  const [adminCredential, setAdminCredential] =
    useState<PasswordVerifier | null>(readStoredAdminCredential);

  useEffect(() => {
    if (shouldMigrateLegacyCredentials.current) return;
    localStorage.setItem(
      STUDENT_CREDENTIALS_KEY,
      JSON.stringify(studentCredentials)
    );
  }, [studentCredentials]);

  useEffect(() => {
    if (adminCredential) {
      localStorage.setItem(
        ADMIN_CREDENTIAL_KEY,
        JSON.stringify(adminCredential)
      );
    } else {
      localStorage.removeItem(ADMIN_CREDENTIAL_KEY);
    }
  }, [adminCredential]);

  useEffect(() => {
    const clearLegacyCredentials = () =>
      LEGACY_CREDENTIAL_KEYS.forEach((key) => localStorage.removeItem(key));

    const migrateLegacyCredentials = async (): Promise<
      StudentCredential[] | null
    > => {
      if (!shouldMigrateLegacyCredentials.current) {
        clearLegacyCredentials();
        return null;
      }

      try {
        const previousHashedCredentials = parseStudentCredentials(
          localStorage.getItem(PREVIOUS_HASHED_CREDENTIALS_KEY)
        );
        const legacyPlaintextCredentials = readLegacyPlaintextCredentials();
        let migratedCredentials = previousHashedCredentials;

        if (legacyPlaintextCredentials) {
          const preserveDeletedAccounts =
            localStorage.getItem(LEGACY_SEED_KEY) === "done";
          const credentialMap = new Map<string, StudentCredential>();
          if (!preserveDeletedAccounts) {
            getDefaultStudentCredentials().forEach((credential) =>
              credentialMap.set(credential.id, credential)
            );
          }
          const hashedLegacyCredentials = await Promise.all(
            legacyPlaintextCredentials.map(async ({ id, password }) => ({
              id,
              ...(await createPasswordVerifier(password)),
            }))
          );
          hashedLegacyCredentials.forEach((credential) =>
            credentialMap.set(credential.id, credential)
          );
          migratedCredentials = COUNCIL_ACCOUNT_IDS.flatMap((id) => {
            const credential = credentialMap.get(id);
            return credential ? [credential] : [];
          });
        }

        const credentialsToStore =
          migratedCredentials ?? getDefaultStudentCredentials();
        localStorage.setItem(
          STUDENT_CREDENTIALS_KEY,
          JSON.stringify(credentialsToStore)
        );
        shouldMigrateLegacyCredentials.current = false;
        clearLegacyCredentials();
        return credentialsToStore;
      } catch (migrationError) {
        console.error("ย้ายข้อมูลรหัสนักเรียนไม่สำเร็จ:", migrationError);
        return null;
      }
    };

    legacyCredentialMigration.current ??= migrateLegacyCredentials();
    let active = true;
    void legacyCredentialMigration.current.then((credentials) => {
      if (active && credentials) setStudentCredentials(credentials);
    });
    return () => {
      active = false;
    };
  }, []);

  const fetchFromSheets = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setIsLoadingData(true);
    setDataError("");
    try {
      const res = await fetch(`${SCRIPT_URL}?refresh=${Date.now()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResponse<unknown[]>;
      if (json.status === "success") {
        const uniqueInspections = deduplicateInspections(
          Array.isArray(json.data) ? json.data.filter(isInspectionRecord) : []
        );
        setInspections(
          uniqueInspections.sort(
            (left, right) =>
              getInspectionRevisionTimestamp(right) -
              getInspectionRevisionTimestamp(left)
          )
        );
        setLastUpdated(new Date());
      } else {
        throw new Error(json.message || "ฐานข้อมูลไม่ตอบกลับตามรูปแบบที่กำหนด");
      }
    } catch (err) {
      console.error("โหลดข้อมูลล้มเหลว:", err);
      setDataError("ไม่สามารถเชื่อมต่อฐานข้อมูลกลางได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      if (showLoadingIndicator) setIsLoadingData(false);
    }
  };

  useEffect(() => {
    void fetchFromSheets(true);
    const refreshInterval = window.setInterval(() => {
      void fetchFromSheets(false);
    }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchFromSheets(false);
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const deleteInspection = async (id: InspectionRecord["id"]) => {
    if (
      !window.confirm(
        "คุณแน่ใจหรือไม่ที่จะลบรายการนี้อย่างถาวรออกจากฐานข้อมูล?"
      )
    )
      return false;
    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      });
      const json = await response.json();
      if (json.status === "success") {
        alert("ลบข้อมูลสำเร็จ!");
        setInspections(
          inspections.filter((item) => String(item.id) !== String(id))
        );
        return true;
      } else {
        alert("เกิดข้อผิดพลาด: " + json.message);
        return false;
      }
    } catch (e) {
      alert("เชื่อมต่อฐานข้อมูลเพื่อลบล้มเหลว");
      return false;
    }
  };

  // ใช้จุดอัปเดตเดียวกันทั้งหน้าอนุมัติ ตารางรายงาน และปฏิทิน
  // เมื่อบันทึกสำเร็จทุกหน้าจะเห็นคะแนนล่าสุดจาก Google Sheets ทันที
  const updateInspectionRecord = async (
    updatedItem: InspectionRecord
  ): Promise<boolean> => {
    try {
      const payload = {
        action: "update",
        id: updatedItem.id,
        zoneId: Number(updatedItem.zoneId),
        score: Number(updatedItem.score),
        notes: updatedItem.notes || "",
        status: updatedItem.status,
        date: updatedItem.date,
        images: updatedItem.images || [],
      };
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.status !== "success") {
        alert("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + json.message);
        return false;
      }

      setInspections((current) =>
        deduplicateInspections(
          current.map((item) =>
            String(item.id) === String(updatedItem.id) ? updatedItem : item
          )
        )
      );
      await fetchFromSheets();
      return true;
    } catch (e) {
      alert("เชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง");
      return false;
    }
  };

  const createInspectionRecord = async (
    newItem: InspectionInput
  ): Promise<InspectionRecord | false> => {
    const payload: InspectionRecord & { action: "create" } = {
      action: "create",
      id: newItem.id || Date.now().toString(),
      date: formatDateKey(newItem.date),
      zoneId: Number(newItem.zoneId),
      score: Number(newItem.score),
      notes: newItem.notes || "บันทึกโดยแอดมินจากตารางรายงาน",
      status: newItem.status || "approved",
      images: newItem.images || [],
    };
    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.status !== "success") {
        alert("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + result.message);
        return false;
      }
      setInspections((current) =>
        deduplicateInspections([payload, ...current])
      );
      await fetchFromSheets();
      return payload;
    } catch (error) {
      alert("เชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง");
      return false;
    }
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const confirmLogout = () => {
    setUser(null);
    setShowLogin(false);
    setShowLogoutConfirm(false);
  };

  const handleDashboardNavigate = (destination: DashboardDestination) => {
    if (destination === "report" && user?.role !== "admin") return;
    setActiveTab(destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!user && showLogin) {
    return (
      <LoginScreen
        onLogin={setUser}
        onBack={() => setShowLogin(false)}
        schoolLogo={schoolLogo}
        studentCredentials={studentCredentials}
        adminCredential={adminCredential}
        setAdminCredential={setAdminCredential}
      />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
        <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-lg print:hidden">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1.5 shadow-sm sm:h-14 sm:w-14">
                {schoolLogo ? (
                  <img
                    src={schoolLogo}
                    alt="ตราโรงเรียนไตรธารวิทยา"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Shield className="h-7 w-7 text-emerald-600" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black leading-tight sm:text-xl">
                  ระบบตรวจเวรทำความสะอาด
                </h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-emerald-50 sm:text-sm">
                    โรงเรียนไตรธารวิทยา
                  </p>
                  <span className="rounded-full border border-white/20 bg-emerald-900/25 px-2 py-0.5 text-[10px] font-bold text-emerald-50">
                    หน้าสาธารณะ
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <div className="hidden rounded-xl border border-white/20 bg-emerald-800/25 p-1 md:flex">
                <span className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">
                  <Home className="h-4 w-4" /> ภาพรวม
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-emerald-800/40 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-white hover:text-emerald-700 sm:px-4"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">เข้าสู่ระบบเจ้าหน้าที่</span>
                <span className="sm:hidden">เข้าสู่ระบบ</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <PublicDashboard
            inspections={inspections}
            zones={ZONES}
            isLoading={isLoadingData}
            error={dataError}
            lastUpdated={lastUpdated}
            onRefresh={() => void fetchFromSheets(true)}
          />
        </main>

        <footer className="px-4 pb-8 text-center text-xs text-slate-400">
          ระบบตรวจเวรทำความสะอาด โรงเรียนไตรธารวิทยา
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 md:pb-0 print:bg-white print:pb-0">
      <header className="bg-emerald-600 text-white p-3 md:p-4 shadow-md print:hidden sticky top-0 z-40">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="group relative bg-white p-1 rounded-full w-11 h-11 md:w-12 md:h-12 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt="School Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Camera className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
              )}
              {user.role === "admin" && (
                <label
                  className="absolute inset-0 flex cursor-pointer items-center justify-center bg-emerald-900/75 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                  title="คลิกเพื่อใส่หรือเปลี่ยนตราโรงเรียน"
                >
                  <Upload className="h-4 w-4" />
                  <span className="sr-only">ใส่หรือเปลี่ยนตราโรงเรียน</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleSchoolLogoUpload}
                  />
                </label>
              )}
            </div>
            <div>
              <h1 className="text-base md:text-xl font-bold leading-tight drop-shadow-sm">
                ระบบตรวจเวรทำความสะอาด
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <p className="text-emerald-100 text-xs md:text-sm">
                  โรงเรียนไตรธารวิทยา
                </p>
                <span className="bg-emerald-800/80 text-emerald-50 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/50 whitespace-nowrap shadow-sm">
                  {user.role === "admin"
                    ? "โหมดครู/แอดมิน"
                    : `สภานักเรียน: ${user.id}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex bg-emerald-700/40 p-1 rounded-xl items-center gap-1 border border-emerald-500/30">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "overview"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-emerald-50 hover:bg-emerald-600/60"
                }`}
              >
                <Home className="w-4 h-4" /> ภาพรวม
              </button>

              <button
                onClick={() => setActiveTab("student")}
                className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "student"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-emerald-50 hover:bg-emerald-600/60"
                }`}
              >
                <Users className="w-4 h-4" /> บันทึกผล
              </button>

              <button
                onClick={() => setActiveTab("teacher")}
                className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "teacher"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-emerald-50 hover:bg-emerald-600/60"
                }`}
              >
                <UserCheck className="w-4 h-4" />{" "}
                {user.role === "admin" ? "ตรวจอนุมัติ" : "สถานะงาน"}
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "calendar"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-emerald-50 hover:bg-emerald-600/60"
                }`}
              >
                <CalendarDays className="w-4 h-4" /> ปฏิทิน
              </button>

              {user.role === "admin" && (
                <>
                  <button
                    onClick={() => setActiveTab("report")}
                    className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === "report"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-emerald-50 hover:bg-emerald-600/60"
                    }`}
                  >
                    <FileText className="w-4 h-4" /> รายงาน
                  </button>
                  <button
                    onClick={() => setActiveTab("users")}
                    className={`px-3 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === "users"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-emerald-50 hover:bg-emerald-600/60"
                    }`}
                  >
                    <Key className="w-4 h-4" /> รหัสผ่าน
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-emerald-700 hover:bg-red-500 text-white p-2 md:px-4 md:py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-emerald-600 hover:border-red-500 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-4 mt-2">
        {activeTab === "overview" ? (
          <PublicDashboard
            inspections={inspections}
            zones={ZONES}
            isLoading={isLoadingData}
            error={dataError}
            lastUpdated={lastUpdated}
            onRefresh={() => void fetchFromSheets(true)}
            onNavigate={handleDashboardNavigate}
            isAuthenticated
            canViewReports={user.role === "admin"}
          />
        ) : isLoadingData ? (
          <div className="py-20 text-center text-slate-500 font-bold flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
            กำลังดึงข้อมูลล่าสุดจาก Google Sheets...
          </div>
        ) : (
          <>
            {activeTab === "student" && (
              <StudentForm
                inspections={inspections}
                onSave={(data: InspectionRecord) =>
                  setInspections(
                    deduplicateInspections([data, ...inspections])
                  )
                }
              />
            )}
            {activeTab === "teacher" && (
              <TeacherApproval
                inspections={inspections}
                deleteInspection={deleteInspection}
                userRole={user.role}
                updateStatus={async (
                  id: InspectionRecord["id"],
                  status: InspectionStatus
                ) => {
                  const item = inspections.find(
                    (inspection) => String(inspection.id) === String(id)
                  );
                  if (!item) return false;
                  return updateInspectionRecord({ ...item, status });
                }}
                updateInspection={updateInspectionRecord}
              />
            )}
            {activeTab === "calendar" && (
              <InspectionCalendar inspections={inspections} />
            )}
            {user.role === "admin" && activeTab === "report" && (
              <ReportView
                inspections={inspections}
                schoolLogo={schoolLogo}
                setSchoolLogo={setSchoolLogo}
                updateInspection={updateInspectionRecord}
                createInspection={createInspectionRecord}
              />
            )}
            {user.role === "admin" && activeTab === "users" && (
              <UserManagement
                credentials={studentCredentials}
                setCredentials={setStudentCredentials}
                adminCredential={adminCredential}
                setAdminCredential={setAdminCredential}
              />
            )}
          </>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] flex justify-start overflow-x-auto p-2 z-50 print:hidden">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex min-w-[68px] flex-1 flex-col items-center p-2 ${
            activeTab === "overview"
              ? "text-emerald-600 font-bold"
              : "text-slate-400"
          }`}
        >
          <Home className="w-6 h-6 mb-1" />
          <span className="text-[10px]">ภาพรวม</span>
        </button>

        <button
          onClick={() => setActiveTab("student")}
          className={`flex min-w-[68px] flex-1 flex-col items-center p-2 ${
            activeTab === "student"
              ? "text-emerald-600 font-bold"
              : "text-slate-400"
          }`}
        >
          <Camera className="w-6 h-6 mb-1" />
          <span className="text-[10px]">บันทึกผล</span>
        </button>

        <button
          onClick={() => setActiveTab("teacher")}
          className={`relative flex min-w-[68px] flex-1 flex-col items-center p-2 ${
            activeTab === "teacher"
              ? "text-emerald-600 font-bold"
              : "text-slate-400"
          }`}
        >
          <UserCheck className="w-6 h-6 mb-1" />
          {inspections.filter((i) => i.status === "pending").length > 0 && (
            <span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full border border-white"></span>
          )}
          <span className="text-[10px]">
            {user.role === "admin" ? "อนุมัติ" : "สถานะ"}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex min-w-[68px] flex-1 flex-col items-center p-2 ${
            activeTab === "calendar"
              ? "text-emerald-600 font-bold"
              : "text-slate-400"
          }`}
        >
          <CalendarDays className="w-6 h-6 mb-1" />
          <span className="text-[10px]">ปฏิทิน</span>
        </button>

        {user.role === "admin" && (
          <>
            <button
              onClick={() => setActiveTab("report")}
              className={`flex min-w-[68px] flex-1 flex-col items-center p-2 ${
                activeTab === "report"
                  ? "text-emerald-600 font-bold"
                  : "text-slate-400"
              }`}
            >
              <FileText className="w-6 h-6 mb-1" />
              <span className="text-[10px]">รายงาน</span>
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex min-w-[68px] flex-1 flex-col items-center p-2 ${
                activeTab === "users"
                  ? "text-emerald-600 font-bold"
                  : "text-slate-400"
              }`}
            >
              <Key className="w-6 h-6 mb-1" />
              <span className="text-[10px]">รหัสผ่าน</span>
            </button>
          </>
        )}
      </nav>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <LogOut className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">
              ยืนยันการออกจากระบบ
            </h3>
            <p className="text-slate-500 mb-6 text-center text-sm">
              คุณต้องการออกจากระบบใช่หรือไม่?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({
  onLogin,
  onBack,
  schoolLogo,
  studentCredentials,
  adminCredential,
  setAdminCredential,
}: LoginScreenProps) {
  const [loginMode, setLoginMode] = useState<LoginMode>("student");
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const normalizedStudentId = studentId.trim();
  const storedStudentCredential = studentCredentials.find(
    (credential) => credential.id === normalizedStudentId
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsChecking(true);

    try {
      if (loginMode === "student") {
        if (!normalizedStudentId || !studentPassword) {
          setError("กรุณากรอกรหัสประจำตัวและรหัสผ่านให้ครบถ้วน");
          return;
        }
        if (!storedStudentCredential) {
          setError("ไม่พบบัญชีสภานักเรียนนี้ หรือบัญชีถูกปิดใช้งาน");
          return;
        }
        if (await verifyPassword(studentPassword, storedStudentCredential)) {
          onLogin({ role: "student", id: storedStudentCredential.id });
        } else {
          setError("รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง");
        }
      } else {
        if (!password) {
          setError("กรุณากรอกรหัสผ่านแอดมิน");
          return;
        }
        if (adminCredential) {
          if (await verifyPassword(password, adminCredential)) {
            onLogin({ role: "admin" });
          } else {
            setError("รหัสผ่านแอดมินไม่ถูกต้อง");
          }
          return;
        }
        if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
          setError(
            `การตั้งค่าครั้งแรกต้องใช้รหัสผ่านอย่างน้อย ${MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษร`
          );
          return;
        }
        setAdminCredential(await createPasswordVerifier(password));
        onLogin({ role: "admin" });
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "ตรวจสอบรหัสผ่านไม่สำเร็จ"
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto bg-slate-50 border-2 border-emerald-100 rounded-full flex items-center justify-center overflow-hidden mb-4 shadow-sm">
            {schoolLogo ? (
              <img
                src={schoolLogo}
                alt="School Logo"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <Shield className="w-12 h-12 text-emerald-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            ระบบตรวจเวรทำความสะอาด
          </h1>
          <p className="text-slate-500">โรงเรียนไตรธารวิทยา</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setLoginMode("student");
              setError("");
            }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              loginMode === "student"
                ? "bg-white shadow text-emerald-700"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            สภานักเรียน
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("admin");
              setError("");
            }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              loginMode === "admin"
                ? "bg-white shadow text-emerald-700"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            ครู / แอดมิน
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {loginMode === "student" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  รหัสประจำตัว (สภานักเรียน)
                </label>
                <div className="relative">
                  <Users className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="เช่น สภา01"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="กรอกรหัสผ่าน"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                รหัสผ่านสำหรับครูผู้ดูแล
              </label>
              <div className="relative">
                <Key className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="กรอกรหัสผ่าน"
                  value={password}
                  minLength={MIN_ADMIN_PASSWORD_LENGTH}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>
              {!adminCredential && (
                <p className="mt-2 text-xs text-amber-700">
                  ใช้งานครั้งแรกบนอุปกรณ์นี้: กรุณาตั้งรหัสใหม่อย่างน้อย {MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษร ระบบจะเก็บเฉพาะค่า hash บนเครื่องนี้
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isChecking}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-lg mt-4"
          >
            {isChecking ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            การล็อกอินนี้เป็นเพียงการกั้นหน้าจอบนอุปกรณ์ จนกว่า API ฝั่งเซิร์ฟเวอร์จะเปิดใช้ระบบยืนยันตัวตน
          </p>
        </form>

        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <Home className="h-4 w-4" /> กลับไปดูภาพรวมสาธารณะ
        </button>
      </div>
    </div>
  );
}

function StudentForm({ onSave, inspections }: StudentFormProps) {
  const [formData, setFormData] = useState<StudentFormState>({
    date: getDefaultWeekday(),
    zoneId: "",
    score: null,
    notes: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const hasExistingInspection = (
    zoneId: string | number,
    date = formData.date
  ) => {
    if (!zoneId || !date) return false;
    return inspections.some(
      (item) =>
        formatDateKey(item.date) === date &&
        Number(item.zoneId) === Number(zoneId)
    );
  };
  const isReplacingExisting = hasExistingInspection(formData.zoneId);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 3) {
      alert("กรุณาอัปโหลดรูปภาพให้ครบ 3 รูปเท่านั้น");
      return;
    }
    try {
      setIsSubmitting(true);
      const compressedImages = await Promise.all(
        files.map((file) => compressImage(file))
      );
      setImages((prev) => [...prev, ...compressedImages]);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการจัดการรูปภาพ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDateStr = e.target.value;
    const day = new Date(selectedDateStr).getDay();
    if (day === 0 || day === 6) {
      alert("⚠️ กรุณาเลือกเฉพาะ 'วันจันทร์ - วันศุกร์' เท่านั้นครับ");
      return;
    }
    setFormData({ ...formData, date: selectedDateStr });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.zoneId) return alert("กรุณาเลือกเขตพื้นที่");
    if (formData.score === null) return alert("กรุณาให้คะแนน");
    if (images.length !== 3) return alert("กรุณาแนบรูปภาพให้ครบ 3 รูป");

    setIsSubmitting(true);
    try {
      const payload: InspectionRecord & { action: "create" } = {
        action: "create",
        id: Date.now().toString(),
        date: formData.date,
        zoneId: parseInt(formData.zoneId),
        score: formData.score,
        notes: formData.notes,
        status: "pending",
        images: images,
      };

      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (result.status === "success") {
        onSave(payload);
        setMessage(
          isReplacingExisting
            ? "บันทึกข้อมูลล่าสุดแล้ว รายการใหม่นี้จะแทนรายการเดิมของวันและเขตเดียวกัน"
            : "บันทึกข้อมูลลงฐานข้อมูลสำเร็จ! รอครูผู้ดูแลยืนยัน"
        );
        setFormData({ ...formData, zoneId: "", score: null, notes: "" });
        setImages([]);
        setTimeout(() => setMessage(""), 4000);
      } else {
        alert("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + result.message);
      }
    } catch (e) {
      alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-3">
        <Upload className="text-emerald-500" /> บันทึกการตรวจเวรประจำวัน
      </h2>

      {message && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0" /> {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              วันที่ตรวจ{" "}
              <span className="text-xs text-red-500 font-normal">
                (จ.-ศ. เท่านั้น)
              </span>
            </label>
            <input
              type="date"
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              value={formData.date}
              onChange={handleDateChange}
              max={formatDateKey(new Date())}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              เขตพื้นที่รับผิดชอบ
            </label>
            <select
              className="w-full p-3 border rounded-lg outline-none"
              value={formData.zoneId}
              onChange={(e) =>
                setFormData({ ...formData, zoneId: e.target.value })
              }
              required
            >
              <option value="">-- เลือกเขตพื้นที่ --</option>
              {ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.class})
                  {hasExistingInspection(z.id) ? " — ส่งใหม่แทนรายการเดิม" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formData.zoneId && (
          <div className="space-y-2">
            {isReplacingExisting && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="font-bold">พบรายการเดิม:</span> เมื่อกดบันทึก
                ระบบจะถือข้อมูลและรูปภาพชุดใหม่นี้เป็นรายการล่าสุดแทนชุดเดิม
              </div>
            )}
            <div className="bg-slate-50 p-3 rounded-lg border text-sm text-slate-600">
              <span className="font-semibold text-emerald-700">รายละเอียด:</span>{" "}
              {ZONES.find((z) => z.id === parseInt(formData.zoneId))?.desc}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-2">
            เกณฑ์การให้คะแนน
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RUBRIC.map((r) => (
              <div
                key={r.score}
                onClick={() => setFormData({ ...formData, score: r.score })}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.score === r.score
                    ? r.color
                    : "border-slate-200 hover:border-emerald-300"
                }`}
              >
                <div className="flex justify-between items-center font-bold">
                  <span>
                    {r.score} คะแนน - {r.label}
                  </span>
                  {formData.score === r.score && (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </div>
                <p className="text-xs mt-1 opacity-80">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            รูปภาพประกอบ (ต้องแนบ 3 รูป)
          </label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-lg border bg-slate-100 overflow-hidden group"
              >
                <img
                  src={src}
                  alt="Evidence"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
            {[...Array(3 - images.length)].map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-slate-50"
              >
                <Camera className="w-8 h-8 mb-1 opacity-50" />
                <span className="text-xs">
                  รูปที่ {images.length + idx + 1}
                </span>
              </div>
            ))}
          </div>
          {images.length < 3 && (
            <label className="block w-full text-center p-3 bg-slate-100 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-200">
              <span className="font-medium text-emerald-700">
                คลิกเพื่อเลือกรูปภาพ / ถ่ายรูป
              </span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={images.length >= 3 || isSubmitting}
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            หมายเหตุ / ปัญหาที่พบ (ถ้ามี)
          </label>
          <textarea
            className="w-full p-3 border rounded-lg outline-none"
            rows={2}
            placeholder="เช่น อุปกรณ์ชำรุด..."
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"
        >
          {isSubmitting ? "กำลังดำเนินการ..." : "บันทึกและส่งข้อมูล"}
        </button>
      </form>
    </div>
  );
}

function InspectionCalendar({
  inspections,
}: {
  inspections: InspectionRecord[];
}) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const toDateKey = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayKey = toDateKey(now);
  const [viewMonth, setViewMonth] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const recordsByDate = inspections.reduce<Record<string, InspectionRecord[]>>(
    (acc, item) => {
      const key = formatDateKey(item.date);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {}
  );

  const getDayInfo = (date: Date): CalendarDayInfo => {
    const key = toDateKey(date);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture = date > now;
    const records = recordsByDate[key] || [];
    const checkedZoneIds = new Set(
      records
        .map((item) => Number(item.zoneId))
        .filter((zoneId) => ZONES.some((zone) => zone.id === zoneId))
    );
    const checkedCount = checkedZoneIds.size;

    let status: CalendarStatus = "missing";
    if (isWeekend) status = "weekend";
    else if (isFuture) status = "future";
    else if (checkedCount >= ZONES.length) status = "complete";
    else if (checkedCount > 0) status = "partial";

    return {
      key,
      records,
      checkedCount,
      isWeekend,
      isFuture,
      status,
    };
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmptyDays = new Date(year, month, 1).getDay();
  const calendarCells = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const monthSummary = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return getDayInfo(date);
  }).reduce(
    (summary, day) => {
      if (day.isWeekend || day.isFuture) return summary;
      summary.scheduled += 1;
      summary.checkedZones += day.checkedCount;
      if (day.status === "complete") summary.complete += 1;
      if (day.status === "partial") summary.partial += 1;
      if (day.status === "missing") summary.missing += 1;
      return summary;
    },
    { scheduled: 0, complete: 0, partial: 0, missing: 0, checkedZones: 0 }
  );

  const coveragePercent = monthSummary.scheduled
    ? Math.round(
        (monthSummary.checkedZones /
          (monthSummary.scheduled * ZONES.length)) *
          100
      )
    : 0;

  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const selectedInfo = getDayInfo(selectedDateObject);
  const selectedDateLabel = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selectedDateObject);
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(viewMonth);

  const changeMonth = (offset: number) => {
    setViewMonth(new Date(year, month + offset, 1));
  };

  const goToCurrentMonth = () => {
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey);
  };

  const statusStyles: Record<
    CalendarStatus,
    { cell: string; badge: string; label: string }
  > = {
    complete: {
      cell: "bg-emerald-50 border-emerald-300 hover:bg-emerald-100",
      badge: "bg-emerald-600 text-white",
      label: `ครบ ${ZONES.length}/${ZONES.length}`,
    },
    partial: {
      cell: "bg-amber-50 border-amber-300 hover:bg-amber-100",
      badge: "bg-amber-500 text-white",
      label: `${selectedInfo.checkedCount}/${ZONES.length} เขต`,
    },
    missing: {
      cell: "bg-red-50 border-red-200 hover:bg-red-100",
      badge: "bg-red-500 text-white",
      label: "ยังไม่ตรวจ",
    },
    future: {
      cell: "bg-white border-slate-200 hover:bg-slate-50",
      badge: "bg-slate-100 text-slate-500",
      label: "รอตรวจ",
    },
    weekend: {
      cell: "bg-slate-100 border-slate-200 text-slate-400",
      badge: "bg-slate-200 text-slate-500",
      label: "วันหยุด",
    },
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-lg">
        <div className="p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">ปฏิทินการตรวจเวร</h2>
                  <p className="text-emerald-100 text-sm">
                    ตรวจสอบวันที่และเขตพื้นที่ที่ยังบันทึกไม่ครบ
                  </p>
                </div>
              </div>
            </div>
            <div className="self-start md:self-auto rounded-full bg-white/15 border border-white/20 px-4 py-2 text-sm font-bold">
              ตรวจเฉพาะวันจันทร์–วันศุกร์
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="rounded-xl bg-white/12 border border-white/15 p-4">
              <p className="text-xs text-emerald-100">ตรวจครบทุกเขต</p>
              <p className="text-2xl font-bold mt-1">
                {monthSummary.complete} วัน
              </p>
            </div>
            <div className="rounded-xl bg-white/12 border border-white/15 p-4">
              <p className="text-xs text-emerald-100">ตรวจบางส่วน</p>
              <p className="text-2xl font-bold mt-1">
                {monthSummary.partial} วัน
              </p>
            </div>
            <div className="rounded-xl bg-white/12 border border-white/15 p-4">
              <p className="text-xs text-emerald-100">ยังไม่ได้ตรวจ</p>
              <p className="text-2xl font-bold mt-1">
                {monthSummary.missing} วัน
              </p>
            </div>
            <div className="rounded-xl bg-white text-emerald-700 p-4 shadow-sm">
              <p className="text-xs text-emerald-600">ความครอบคลุมรายเดือน</p>
              <div className="flex items-end justify-between gap-3 mt-1">
                <p className="text-2xl font-bold">{coveragePercent}%</p>
                <p className="text-[10px] text-slate-500 text-right">
                  {monthSummary.checkedZones}/
                  {monthSummary.scheduled * ZONES.length} เขต
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5 items-start">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-lg"
                aria-label="เดือนก่อนหน้า"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-lg"
                aria-label="เดือนถัดไป"
              >
                ›
              </button>
              <h3 className="font-bold text-lg md:text-xl ml-1 capitalize">
                {monthLabel}
              </h3>
            </div>
            <button
              type="button"
              onClick={goToCurrentMonth}
              className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-bold border border-emerald-200"
            >
              เดือนปัจจุบัน
            </button>
          </div>

          <div className="p-2 sm:p-4">
            <div className="grid grid-cols-7 mb-2">
              {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map(
                (day, index) => (
                  <div
                    key={day}
                    className={`py-2 text-center text-xs sm:text-sm font-bold ${
                      index === 0 || index === 6
                        ? "text-rose-400"
                        : "text-slate-500"
                    }`}
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarCells.map((day, index) => {
                if (!day)
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[72px] sm:min-h-[104px]"
                    />
                  );

                const date = new Date(year, month, day);
                const info = getDayInfo(date);
                const style = statusStyles[info.status];
                const isToday = info.key === todayKey;
                const isSelected = info.key === selectedDate;
                const cellLabel =
                  info.status === "complete"
                    ? `ครบ ${ZONES.length}/${ZONES.length}`
                    : info.status === "partial"
                    ? `${info.checkedCount}/${ZONES.length} เขต`
                    : style.label;

                return (
                  <button
                    type="button"
                    key={info.key}
                    onClick={() => setSelectedDate(info.key)}
                    className={`relative min-h-[72px] sm:min-h-[104px] rounded-xl border p-1.5 sm:p-2 text-left transition-all ${
                      style.cell
                    } ${
                      isSelected
                        ? "ring-2 ring-emerald-600 ring-offset-1 shadow-md"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                          isToday
                            ? "bg-emerald-700 text-white"
                            : "text-slate-700"
                        }`}
                      >
                        {day}
                      </span>
                      {info.status === "complete" && (
                        <CheckCircle className="hidden sm:block w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <span
                      className={`absolute left-1.5 right-1.5 bottom-1.5 rounded-md px-1 py-1 text-[9px] sm:text-[11px] text-center font-bold truncate ${style.badge}`}
                    >
                      {cellLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> ตรวจครบ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> ตรวจบางส่วน
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" /> ยังไม่ได้ตรวจ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-300" /> วันหยุด/วันในอนาคต
              </span>
            </div>
          </div>
        </section>

        <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden xl:sticky xl:top-24">
          <div className="p-5 border-b border-slate-200">
            <p className="text-xs font-bold text-emerald-600 mb-1">
              รายละเอียดประจำวันที่เลือก
            </p>
            <h3 className="text-lg font-bold text-slate-800">
              {selectedDateLabel}
            </h3>
            <div className="flex flex-wrap gap-2 mt-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  statusStyles[selectedInfo.status].badge
                }`}
              >
                {selectedInfo.isWeekend
                  ? "ไม่มีการตรวจในวันหยุด"
                  : selectedInfo.isFuture
                  ? "ยังไม่ถึงวันตรวจ"
                  : selectedInfo.status === "complete"
                  ? "ตรวจครบทุกเขต"
                  : selectedInfo.status === "partial"
                  ? `ตรวจแล้ว ${selectedInfo.checkedCount}/${ZONES.length} เขต`
                  : "ยังไม่มีการตรวจ"}
              </span>
            </div>
          </div>

          {selectedInfo.isWeekend ? (
            <div className="p-8 text-center text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold">วันเสาร์–อาทิตย์เป็นวันหยุด</p>
              <p className="text-sm mt-1">ระบบไม่นับเป็นวันที่ต้องตรวจเวร</p>
            </div>
          ) : selectedInfo.isFuture ? (
            <div className="p-8 text-center text-slate-500">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold">ยังไม่ถึงกำหนดตรวจ</p>
              <p className="text-sm mt-1">กลับมาตรวจสอบได้เมื่อถึงวันดังกล่าว</p>
            </div>
          ) : (
            <div className="p-4 max-h-[540px] overflow-y-auto">
              <div className="space-y-2">
                {ZONES.map((zone) => {
                  const record = selectedInfo.records.find(
                    (item) => Number(item.zoneId) === zone.id
                  );
                  const recordStatus = record
                    ? record.status === "approved"
                      ? {
                          label: "อนุมัติแล้ว",
                          className: "bg-emerald-100 text-emerald-700",
                        }
                      : record.status === "rejected"
                      ? {
                          label: "ส่งกลับแก้ไข",
                          className: "bg-red-100 text-red-700",
                        }
                      : {
                          label: "รออนุมัติ",
                          className: "bg-amber-100 text-amber-700",
                        }
                    : null;

                  return (
                    <div
                      key={zone.id}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                        record
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-red-100 bg-red-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            record
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-red-400 border border-red-200"
                          }`}
                        >
                          {record ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <AlertCircle className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800">
                            {zone.name} · {zone.class}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {record
                              ? `บันทึกแล้ว · ${record.score}/3 คะแนน`
                              : "ยังไม่มีข้อมูลการตรวจ"}
                          </p>
                        </div>
                      </div>
                      {recordStatus && (
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap ${recordStatus.className}`}
                        >
                          {recordStatus.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TeacherApproval({
  inspections,
  updateStatus,
  updateInspection,
  deleteInspection,
  userRole,
}: TeacherApprovalProps) {
  const pending = inspections.filter((i) => i.status === "pending");
  const history = inspections
    .filter((i) => i.status !== "pending")
    .slice(0, 15);

  const [editingItem, setEditingItem] = useState<InspectionRecord | null>(null);
  const [processingId, setProcessingId] = useState<
    InspectionRecord["id"] | null
  >(null);

  const handleStatusClick = async (
    id: InspectionRecord["id"],
    status: InspectionStatus
  ) => {
    setProcessingId(id);
    await updateStatus(id, status);
    setProcessingId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingItem) return;
    setProcessingId(editingItem.id);
    const success = await updateInspection(editingItem);
    if (success) setEditingItem(null);
    setProcessingId(null);
  };

  const handleEditDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingItem) return;
    const selectedDateStr = e.target.value;
    const day = new Date(selectedDateStr).getDay();
    if (day === 0 || day === 6) {
      alert("⚠️ กรุณาเลือกเฉพาะ 'วันจันทร์ - วันศุกร์' เท่านั้นครับ");
      return;
    }
    setEditingItem({ ...editingItem, date: selectedDateStr });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Clock className="text-yellow-500" /> รอการตรวจสอบยืนยัน (
          {pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>ไม่มีรายการที่รอการอนุมัติ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((item) => {
              const zone = ZONES.find((z) => z.id === Number(item.zoneId)) || {
                name: "เขตไม่ระบุ",
                class: "",
              };
              const isItemProcessing = processingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`border border-yellow-200 bg-yellow-50/30 rounded-xl p-4 flex flex-col ${
                    isItemProcessing ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">
                        {zone.name} ({zone.class})
                      </h3>
                      <p className="text-sm text-slate-500">
                        วันที่: {item.date}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full border border-yellow-300">
                        รอตรวจสอบ
                      </span>
                      {userRole === "admin" && (
                        <button
                          onClick={() => setEditingItem(item)}
                          disabled={isItemProcessing}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-1 rounded-md shadow-sm"
                        >
                          <Edit className="w-3 h-3" /> แก้ไข
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="font-semibold">คะแนนที่สภาประเมิน: </span>
                    <span className="text-lg font-bold text-emerald-600">
                      {item.score}
                    </span>{" "}
                    / 3
                  </div>

                  {item.notes && (
                    <div className="bg-white p-2 rounded border text-sm mb-3 text-slate-600">
                      <span className="font-semibold text-slate-700">
                        หมายเหตุ:
                      </span>{" "}
                      {item.notes}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {item.images &&
                      item.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt="Evidence"
                          className="aspect-square object-cover rounded border"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://placehold.co/400x300?text=No+Image";
                          }}
                        />
                      ))}
                  </div>

                  {userRole === "admin" ? (
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => handleStatusClick(item.id, "approved")}
                        disabled={isItemProcessing}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" /> อนุมัติ
                      </button>
                      <button
                        onClick={() => handleStatusClick(item.id, "rejected")}
                        disabled={isItemProcessing}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg font-medium flex items-center justify-center gap-2 border border-red-200"
                      >
                        <XCircle className="w-4 h-4" /> ปฏิเสธ
                      </button>
                      <button
                        onClick={() => deleteInspection(item.id)}
                        disabled={isItemProcessing}
                        className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-lg transition-colors"
                        title="ลบรายการถาวร"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-auto text-sm text-slate-500 text-center bg-white/50 py-2 rounded-lg border border-slate-200 font-medium">
                      ⏳ รอครูผู้ดูแลตรวจสอบ
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-90">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />{" "}
          ประวัติการตรวจสอบล่าสุด
        </h2>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีประวัติ</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg border border-slate-200 text-sm"
              >
                <div>
                  <span className="font-bold text-slate-800">
                    {ZONES.find((z) => z.id === Number(item.zoneId))?.name}
                  </span>
                  <span className="text-slate-500 ml-2">{item.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 mr-2">
                    คะแนน: {item.score}
                  </span>
                  {item.status === "approved" ? (
                    <span className="text-green-700 bg-green-100 px-2 py-1 rounded text-xs font-bold border border-green-200 w-16 text-center">
                      อนุมัติ
                    </span>
                  ) : (
                    <span className="text-red-700 bg-red-100 px-2 py-1 rounded text-xs font-bold border border-red-200 w-16 text-center">
                      ปฏิเสธ
                    </span>
                  )}
                  {userRole === "admin" && (
                    <>
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 bg-white rounded-md text-slate-500 hover:text-blue-600 border border-slate-200"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteInspection(item.id)}
                        className="p-1.5 bg-white rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 border border-slate-200"
                        title="ลบข้อมูล"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" /> แก้ไขข้อมูลการตรวจเวร
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg text-sm border border-slate-200">
                <p className="mb-2">
                  <span className="font-bold text-slate-700">เขตพื้นที่:</span>{" "}
                  {ZONES.find((z) => z.id === Number(editingItem.zoneId))?.name}
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่ตรวจ{" "}
                    <span className="text-red-500 font-normal">
                      (อนุญาตเฉพาะจันทร์-ศุกร์)
                    </span>
                  </label>
                  <input
                    type="date"
                    value={editingItem.date}
                    onChange={handleEditDateChange}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  สถานะ
                </label>
                <select
                  value={editingItem.status}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      status: e.target.value as InspectionStatus,
                    })
                  }
                  className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">รอตรวจสอบ</option>
                  <option value="approved">อนุมัติแล้ว (นำไปคำนวณ)</option>
                  <option value="rejected">ไม่อนุมัติ (ไม่นำไปคำนวณ)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  คะแนน (0-3)
                </label>
                <select
                  value={editingItem.score ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      score: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {RUBRIC.map((r) => (
                    <option key={r.score} value={r.score}>
                      {r.score} คะแนน - {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  value={editingItem.notes}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, notes: e.target.value })
                  }
                  className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                ></textarea>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportView({
  inspections,
  schoolLogo,
  setSchoolLogo,
  updateInspection,
  createInspection,
}: ReportViewProps) {
  const normalizeToMonday = (dateValue: string | Date): string => {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return formatDateKey(new Date());
    date.setHours(12, 0, 0, 0);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return formatDateKey(date);
  };

  const inferredSemesterStart = (() => {
    const dates = inspections
      .map((item) => new Date(item.date))
      .filter((date) => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return normalizeToMonday(dates[0] || new Date());
  })();

  const [selectedReportWeek, setSelectedReportWeek] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [exporting, setExporting] = useState("");
  const [savingCell, setSavingCell] = useState("");
  const [savedCell, setSavedCell] = useState("");
  const [reportMode, setReportMode] = useState("weekly");

  const handleReportLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setSchoolLogo(await prepareSchoolLogo(file));
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "เพิ่มตราโรงเรียนไม่สำเร็จ"
      );
    }
  };

  const [settings, setSettings] = useState<ReportSettings>(() => {
    const defaults: ReportSettings = {
      president: "",
      teacher: "",
      director: "",
      headStudentAffairs: "",
      term: "1",
      year: String(new Date().getFullYear() + 543),
      semesterStart: inferredSemesterStart,
    };
    const saved = localStorage.getItem("cleaning_report_settings");
    if (!saved) return defaults;

    try {
      const parsed = JSON.parse(saved) as unknown;
      if (!parsed || typeof parsed !== "object") return defaults;
      const record = parsed as Record<string, unknown>;
      const hasSemesterStart =
        typeof record.semesterStart === "string" &&
        record.semesterStart.trim().length > 0;
      const semesterStart = hasSemesterStart
        ? normalizeToMonday(record.semesterStart as string)
        : inferredSemesterStart;
      let inferredTerm = "1";
      let inferredYear = defaults.year;
      if (!hasSemesterStart) {
        const inferredDate = new Date(`${inferredSemesterStart}T12:00:00`);
        inferredTerm =
          inferredDate.getMonth() >= 4 && inferredDate.getMonth() <= 9
            ? "1"
            : "2";
        inferredYear = String(inferredDate.getFullYear() + 543);
      }
      const teacher =
        typeof record.teacher === "string" ? record.teacher : "";
      return {
        president:
          typeof record.president === "string" ? record.president : "",
        teacher,
        director:
          typeof record.director === "string" ? record.director : "",
        headStudentAffairs:
          typeof record.headStudentAffairs === "string"
            ? record.headStudentAffairs
            : teacher,
        term:
          record.term === "1" || record.term === "2"
            ? record.term
            : inferredTerm,
        year:
          typeof record.year === "string" && record.year.trim()
            ? record.year
            : inferredYear,
        semesterStart,
      };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem("cleaning_report_settings", JSON.stringify(settings));
  }, [settings]);

  const approvedData = inspections.filter((i) => i.status === "approved");
  const WEEKS = Array.from({ length: 21 }, (_, i) => i + 1);

  const getWeekNumFromDate = (dateStr: string | Date): number => {
    if (!dateStr || !settings.semesterStart) return 0;
    return getAcademicWeekNumber(dateStr, settings.semesterStart);
  };

  const getWeekDatesForWeek = (weekNo: number): string[] => {
    const baseMonday = new Date(`${settings.semesterStart}T12:00:00`);
    baseMonday.setHours(12, 0, 0, 0);

    baseMonday.setDate(baseMonday.getDate() + (weekNo - 1) * 7);

    const days: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(baseMonday);
      d.setDate(baseMonday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
  };

  const currentAcademicWeek = getWeekNumFromDate(new Date());

  useEffect(() => {
    if (currentAcademicWeek >= 1 && currentAcademicWeek <= WEEKS.length) {
      setSelectedReportWeek(currentAcademicWeek);
    }
  }, [settings.semesterStart]);

  const currentWeekDates = getWeekDatesForWeek(selectedReportWeek);

  const getSemesterScore = (weekNo: number, zoneId: number): number => {
    return approvedData
      .filter(
        (i) =>
          Number(i.zoneId) === Number(zoneId) &&
          getWeekNumFromDate(i.date) === weekNo
      )
      .reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  };

  const getZoneTotalSemester = (zoneId: number): number => {
    return approvedData
      .filter((i) => {
        const weekNo = getWeekNumFromDate(i.date);
        return (
          Number(i.zoneId) === Number(zoneId) &&
          isAcademicWeekInTerm(weekNo, WEEKS.length)
        );
      })
      .reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  };

  const calculateGrade = (percent: number): string => {
    if (percent >= 80) return "ดีเยี่ยม";
    if (percent >= 70) return "ดี";
    if (percent >= 50) return "พอใช้";
    if (percent > 0) return "ปรับปรุง";
    return "-";
  };

  const weeklyFilteredData = approvedData.filter(
    (item) => getWeekNumFromDate(item.date) === selectedReportWeek
  );
  const weeklyReportData = weeklyFilteredData
    .slice()
    .sort((left, right) => {
      const dateCompare = formatDateKey(left.date).localeCompare(
        formatDateKey(right.date)
      );
      return dateCompare || Number(left.zoneId) - Number(right.zoneId);
    });

  const reportFileName = (extension: string): string =>
    `รายงานตรวจเวร_${
      reportMode === "weekly" ? `สัปดาห์_${selectedReportWeek}` : "ภาคเรียน"
    }.${extension}`;

  const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportToExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx-js-style");
      const workbook = XLSX.utils.book_new();
      let summaryRows: Array<Array<string | number>> = [];

      if (reportMode === "weekly") {
        summaryRows = [
          [`รายงานตรวจเวร สัปดาห์ที่ ${selectedReportWeek}`],
          [
            `ระหว่างวันที่ ${formatThaiDateShort(
              currentWeekDates[0]
            )} - ${formatThaiDateShort(currentWeekDates[4])}`,
          ],
          [
            "เขตพื้นที่",
            "ชั้น",
            ...currentWeekDates.map((date) =>
              new Intl.DateTimeFormat("th-TH", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(new Date(`${date}T12:00:00`))
            ),
            "รวม",
          ],
          ...ZONES.map((zone) => {
            const dayScores = currentWeekDates.map((date) => {
              const record = approvedData.find(
                (item) =>
                  Number(item.zoneId) === zone.id &&
                  formatDateKey(item.date) === date
              );
              return record ? Number(record.score) : "";
            });
            const total = dayScores.reduce<number>(
              (sum, score) => sum + (score === "" ? 0 : Number(score)),
              0
            );
            return [
              zone.name,
              zone.fullClass,
              ...dayScores,
              dayScores.some((score) => score !== "") ? total : "",
            ];
          }),
        ];
      } else {
        summaryRows = [
          [
            `สรุปผลรายภาคเรียนที่ ${settings.term} ปีการศึกษา ${settings.year}`,
          ],
          ["สัปดาห์ที่", ...ZONES.map((zone) => zone.name)],
          ...WEEKS.map((week) => [
            week,
            ...ZONES.map((zone) => getSemesterScore(week, zone.id)),
          ]),
          ["รวมคะแนน", ...ZONES.map((zone) => getZoneTotalSemester(zone.id))],
          [
            "คิดเป็น %",
            ...ZONES.map((zone) =>
              Number(((getZoneTotalSemester(zone.id) / 315) * 100).toFixed(0))
            ),
          ],
        ];
      }

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      const lastColumn = reportMode === "weekly" ? "H" : "J";
      summarySheet["!merges"] = [
        XLSX.utils.decode_range(`A1:${lastColumn}1`),
      ];
      if (reportMode === "weekly") {
        summarySheet["!merges"].push(
          XLSX.utils.decode_range(`A2:${lastColumn}2`)
        );
        summarySheet["!autofilter"] = { ref: "A3:H12" };
        summarySheet["!cols"] = [
          { wch: 14 },
          { wch: 28 },
          ...Array.from({ length: 5 }, () => ({ wch: 13 })),
          { wch: 10 },
        ];
      } else {
        summarySheet["!autofilter"] = { ref: "A2:J23" };
        summarySheet["!cols"] = [
          { wch: 13 },
          ...Array.from({ length: 9 }, () => ({ wch: 11 })),
        ];
      }
      summarySheet["!margins"] = {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      };
      summarySheet["!pageSetup"] = {
        orientation: reportMode === "semester" ? "landscape" : "portrait",
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      };

      const thinBorder = {
        top: { style: "thin", color: { rgb: "475569" } },
        bottom: { style: "thin", color: { rgb: "475569" } },
        left: { style: "thin", color: { rgb: "475569" } },
        right: { style: "thin", color: { rgb: "475569" } },
      };
      const styleSheet = (
        sheet: SpreadsheetWorksheet,
        rows: SpreadsheetRow[],
        {
          titleRows = [],
          headerRows = [],
          tableStartRow = 0,
          totalRows = [],
        }: SpreadsheetStyleOptions = {}
      ) => {
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
        for (let row = range.s.r; row <= range.e.r; row += 1) {
          for (let column = range.s.c; column <= range.e.c; column += 1) {
            const address = XLSX.utils.encode_cell({ r: row, c: column });
            if (!sheet[address]) sheet[address] = { t: "s", v: "" };
            const isTitle = titleRows.includes(row);
            const isHeader = headerRows.includes(row);
            const isTotal = totalRows.includes(row);
            sheet[address].s = {
              font: {
                name: "TH Sarabun PSK",
                sz: isTitle ? 20 : 16,
                bold: isTitle || isHeader || isTotal,
                color: { rgb: "0F172A" },
              },
              alignment: {
                horizontal: "center",
                vertical: "center",
                wrapText: true,
              },
              border: row >= tableStartRow ? thinBorder : undefined,
              fill: isHeader
                ? { patternType: "solid", fgColor: { rgb: "D1FAE5" } }
                : isTotal
                ? { patternType: "solid", fgColor: { rgb: "F1F5F9" } }
                : undefined,
            };
          }
        }
        sheet["!rows"] = rows.map((_, row) => ({
          hpt: titleRows.includes(row) ? 30 : headerRows.includes(row) ? 28 : 25,
        }));
      };

      styleSheet(summarySheet, summaryRows, {
        titleRows: reportMode === "weekly" ? [0, 1] : [0],
        headerRows: reportMode === "weekly" ? [2] : [1],
        tableStartRow: reportMode === "weekly" ? 2 : 1,
        totalRows:
          reportMode === "semester"
            ? [summaryRows.length - 2, summaryRows.length - 1]
            : [],
      });
      XLSX.utils.book_append_sheet(workbook, summarySheet, "สรุปผล");

      const detailRows: SpreadsheetRow[] = [
        [
          "วันที่",
          "เขตพื้นที่",
          "ชั้น",
          "คะแนน",
          "สถานะ",
          "หมายเหตุ",
          "รูปที่ 1",
          "รูปที่ 2",
          "รูปที่ 3",
        ],
        ...(reportMode === "weekly" ? weeklyFilteredData : approvedData).map(
          (item) => {
            const zone = ZONES.find(
              (zoneItem) => zoneItem.id === Number(item.zoneId)
            );
            return [
              formatDateKey(item.date),
              zone?.name || "",
              zone?.fullClass || "",
              Number(item.score),
              item.status === "approved" ? "อนุมัติ" : item.status,
              item.notes || "",
              item.images?.[0] || "",
              item.images?.[1] || "",
              item.images?.[2] || "",
            ];
          }
        ),
      ];
      const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
      detailSheet["!autofilter"] = {
        ref: `A1:I${Math.max(detailRows.length, 1)}`,
      };
      detailSheet["!cols"] = [
        { wch: 13 },
        { wch: 13 },
        { wch: 26 },
        { wch: 9 },
        { wch: 12 },
        { wch: 34 },
        { wch: 35 },
        { wch: 35 },
        { wch: 35 },
      ];
      detailSheet["!margins"] = {
        left: 0.25,
        right: 0.25,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      };
      detailSheet["!pageSetup"] = {
        orientation: "landscape",
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      };
      styleSheet(detailSheet, detailRows, {
        headerRows: [0],
        tableStartRow: 0,
      });
      XLSX.utils.book_append_sheet(workbook, detailSheet, "ข้อมูลรายวัน");
      XLSX.writeFile(workbook, reportFileName("xlsx"), {
        compression: true,
      });
    } finally {
      setExporting("");
    }
  };

  const createWordCell = (
    value: string | number,
    {
      bold = false,
      fill = "FFFFFF",
      align = AlignmentType.CENTER,
    }: { bold?: boolean; fill?: string; align?: WordAlignment } = {}
  ) =>
    new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      shading: { fill, type: ShadingType.CLEAR },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "334155" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "334155" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "334155" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "334155" },
      },
      children: [
        new Paragraph({
          alignment: align,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: String(value ?? ""),
              bold,
              font: "TH Sarabun PSK",
              size: 30,
            }),
          ],
        }),
      ],
    });

  const createWordImageRun = async (
    source: string,
    { maxWidth = 155, maxHeight = 110 } = {}
  ): Promise<ImageRun | null> => {
    if (!source) return null;
    try {
      const [response, dimensions] = await Promise.all([
        fetch(source),
        new Promise<{ width: number; height: number }>((resolve) => {
          const image = new Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => resolve({ width: maxWidth, height: maxHeight });
          image.src = source;
        }),
      ]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = new Uint8Array(await response.arrayBuffer());
      const naturalWidth = Math.max(1, Number(dimensions.width) || maxWidth);
      const naturalHeight = Math.max(1, Number(dimensions.height) || maxHeight);
      const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
      return new ImageRun({
        data,
        transformation: {
          width: Math.max(1, Math.round(naturalWidth * scale)),
          height: Math.max(1, Math.round(naturalHeight * scale)),
        },
      });
    } catch (error) {
      console.warn("Unable to embed report image in Word", error);
      return null;
    }
  };

  const createWordPhotoCell = (imageRun: ImageRun | null) =>
    new TableCell({
      width: { size: 33.33, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 3, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 3, color: "CBD5E1" },
        left: { style: BorderStyle.SINGLE, size: 3, color: "CBD5E1" },
        right: { style: BorderStyle.SINGLE, size: 3, color: "CBD5E1" },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: imageRun
            ? [imageRun]
            : [
                new TextRun({
                  text: "ไม่มีรูปภาพ",
                  italics: true,
                  color: "64748B",
                  font: "TH Sarabun PSK",
                  size: 24,
                }),
              ],
        }),
      ],
    });

  const exportToWord = async () => {
    setExporting("word");
    try {
      const title =
        reportMode === "weekly"
          ? `ตารางบันทึกการปฏิบัติงานทำความสะอาดเขตพื้นที่รับผิดชอบ\nสัปดาห์ที่ ${selectedReportWeek}`
          : `แบบสรุปผลการประเมินรายภาคเรียนที่ ${settings.term} ปีการศึกษา ${settings.year}`;

      const headerRow =
        reportMode === "weekly"
          ? ["เขตพื้นที่ / ชั้น", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "รวม"]
          : ["สัปดาห์ที่", ...ZONES.map((zone) => zone.name)];
      const dataRows: Array<Array<string | number>> =
        reportMode === "weekly"
          ? ZONES.map((zone) => {
              const scores = currentWeekDates.map((date) => {
                const record = approvedData.find(
                  (item) =>
                    Number(item.zoneId) === zone.id &&
                    formatDateKey(item.date) === date
                );
                return record ? Number(record.score) : "-";
              });
              const total = scores.reduce<number>(
                (sum, score) => sum + (score === "-" ? 0 : Number(score)),
                0
              );
              return [
                `${zone.name} ${zone.fullClass}`,
                ...scores,
                scores.some((score) => score !== "-") ? total : "-",
              ];
            })
          : WEEKS.map((week) => [
              week,
              ...ZONES.map((zone) => getSemesterScore(week, zone.id) || "-"),
            ]);

      if (reportMode === "semester") {
        dataRows.push([
          "รวมคะแนน",
          ...ZONES.map((zone) => getZoneTotalSemester(zone.id)),
        ]);
        dataRows.push([
          "คิดเป็น %",
          ...ZONES.map((zone) =>
            ((getZoneTotalSemester(zone.id) / 315) * 100).toFixed(0)
          ),
        ]);
      }

      const reportTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: headerRow.map((value) =>
              createWordCell(value, { bold: true, fill: "D1FAE5" })
            ),
          }),
          ...dataRows.map(
            (row, rowIndex) =>
              new TableRow({
                cantSplit: true,
                children: row.map((value, columnIndex) =>
                  createWordCell(value, {
                    bold:
                      columnIndex === 0 ||
                      (reportMode === "semester" &&
                        rowIndex >= dataRows.length - 2),
                    fill: rowIndex % 2 === 1 ? "F8FAFC" : "FFFFFF",
                    align: AlignmentType.CENTER,
                  })
                ),
              })
          ),
        ],
      });

      const children: Array<Paragraph | Table> = [];
      const logoRun = schoolLogo
        ? await createWordImageRun(schoolLogo, { maxWidth: 85, maxHeight: 85 })
        : null;
      if (logoRun) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 70 },
            children: [logoRun],
          })
        );
      }
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: title,
              bold: true,
              font: "TH Sarabun PSK",
              size: 38,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: "โรงเรียนไตรธารวิทยา",
              bold: true,
              font: "TH Sarabun PSK",
              size: 32,
            }),
          ],
        }),
        reportTable,
        new Paragraph({
          spacing: { before: 260 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text:
                reportMode === "weekly"
                  ? `ลงชื่อ ................................ ประธานนักเรียน     ลงชื่อ ................................ ครูกิจการนักเรียน     ลงชื่อ ................................ ผู้อำนวยการโรงเรียน`
                  : `ลงชื่อ ........................................................ (${settings.headStudentAffairs || "ผู้รับผิดชอบ"}) หัวหน้าฝ่ายกิจการและพัฒนานักเรียน`,
              font: "TH Sarabun PSK",
              size: 30,
            }),
          ],
        })
      );

      if (reportMode === "weekly") {
        children.push(
          new Paragraph({
            pageBreakBefore: true,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `รายละเอียดหลักฐาน สัปดาห์ที่ ${selectedReportWeek}`,
                bold: true,
                font: "TH Sarabun PSK",
                size: 34,
              }),
            ],
          })
        );

        if (!weeklyReportData.length) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "ไม่มีข้อมูลรูปภาพในสัปดาห์นี้",
                  font: "TH Sarabun PSK",
                  size: 30,
                }),
              ],
            })
          );
        }

        for (const item of weeklyReportData) {
          const zone = ZONES.find(
            (zoneItem) => zoneItem.id === Number(item.zoneId)
          );
          children.push(
            new Paragraph({
              keepNext: true,
              spacing: { before: 160, after: 70 },
              children: [
                new TextRun({
                  text:
                    `${zone ? `${zone.name} - ${zone.class}` : "ไม่ทราบเขต"} ` +
                    `(วันที่: ${formatThaiDateShort(item.date)})` +
                    `    คะแนน: ${item.score}/3` +
                    `    หมายเหตุ: ${item.notes || "-"}`,
                  bold: true,
                  font: "TH Sarabun PSK",
                  size: 28,
                }),
              ],
            })
          );
          const sourceImages: string[] = Array.isArray(item.images)
            ? item.images.slice(0, 3).map((source: any) => String(source))
            : [];
          const imageRuns: Array<ImageRun | null> = await Promise.all(
            sourceImages.map((source: string) => createWordImageRun(source))
          );
          while (imageRuns.length < 3) imageRuns.push(null);
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  cantSplit: true,
                  children: imageRuns.map((imageRun) =>
                    createWordPhotoCell(imageRun)
                  ),
                }),
              ],
            })
          );
        }
      }

      const documentFile = new Document({
        sections: [
          {
            properties: {
              page: {
                size: {
                  orientation:
                    reportMode === "semester"
                      ? PageOrientation.LANDSCAPE
                      : PageOrientation.PORTRAIT,
                },
                margin: {
                  top: 720,
                  right: 720,
                  bottom: 720,
                  left: 720,
                },
              },
            },
            children,
          },
        ],
      });
      const blob = await Packer.toBlob(documentFile);
      downloadBlob(blob, reportFileName("docx"));
    } catch (error) {
      console.error(error);
      alert("สร้างไฟล์ Word ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setExporting("");
    }
  };

  const printReport = async () => {
    const element = document.getElementById("printable-area");
    if (!element) return;
    setIsPrinting(true);
    setExporting("pdf");
    let holder: HTMLDivElement | null = null;
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      try {
        await document.fonts?.load('16pt "TH Sarabun PSK"');
        await document.fonts?.ready;
      } catch (fontError) {
        console.warn("Unable to preload TH Sarabun PSK", fontError);
      }

      const exportNode = element.cloneNode(true) as HTMLElement;
      exportNode.classList.add("pdf-export-node");
      exportNode
        .querySelectorAll(".screen-only")
        .forEach((node) => node.remove());
      exportNode.querySelectorAll(".print-only").forEach((node) => {
        node.classList.remove("hidden", "print:block", "print:inline");
      });
      holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "0";
      holder.style.top = "0";
      holder.style.zIndex = "-1000";
      holder.style.pointerEvents = "none";
      holder.style.background = "white";
      holder.style.width = reportMode === "semester" ? "1122px" : "794px";
      holder.appendChild(exportNode);
      document.body.appendChild(holder);

      const opt = {
        margin: [8, 8, 8, 8] as [number, number, number, number],
        filename: reportFileName("pdf"),
        image: { type: "jpeg" as const, quality: 0.98 },
        pagebreak: {
          mode: ["css", "legacy"],
          before: [".page-break-before"],
          avoid: ["tr", ".avoid-break", ".photo-record"],
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: reportMode === "semester" ? 1122 : 794,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: (reportMode === "semester"
            ? "landscape"
            : "portrait") as "landscape" | "portrait",
          compress: true,
        },
      };

      await html2pdf().set(opt).from(exportNode).save();
    } catch (error) {
      console.error(error);
      alert("สร้างไฟล์ PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      holder?.remove();
      setIsPrinting(false);
      setExporting("");
    }
  };

  const handleInlineScoreChange = async (
    record: InspectionRecord | undefined,
    zoneId: number,
    date: string,
    nextScore: string
  ) => {
    if (nextScore === "") return;
    if (
      record &&
      record.status === "approved" &&
      Number(record.score) === Number(nextScore)
    )
      return;
    const cellKey = `${zoneId}-${date}`;
    setSavingCell(cellKey);
    setSavedCell("");
    const success = record
      ? await updateInspection({
          ...record,
          score: Number(nextScore),
          status: "approved",
        })
      : await createInspection({
          date,
          zoneId,
          score: Number(nextScore),
          status: "approved",
          images: [],
          notes: "บันทึกโดยแอดมินจากตารางรายงาน",
        });
    setSavingCell("");
    if (success) {
      setSavedCell(cellKey);
      window.setTimeout(() => setSavedCell(""), 1800);
    }
  };

  return (
    <div className="space-y-6">
      {/* กติกาหน้ากระดาษใช้ร่วมกันทั้งตัวอย่าง, Print และ PDF */}
      <style>{`
        @font-face {
          font-family: 'TH Sarabun PSK';
          src: url('https://raw.githubusercontent.com/SarabunConsortium/TH-Sarabun-PSK/master/THSarabunPSK%20Regular.ttf') format('truetype');
          font-style: normal;
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: 'TH Sarabun PSK';
          src: url('https://raw.githubusercontent.com/SarabunConsortium/TH-Sarabun-PSK/master/THSarabunPSK%20Bold.ttf') format('truetype');
          font-style: normal;
          font-weight: 700;
          font-display: swap;
        }
        .font-sarabun, .font-sarabun * { 
          font-family: 'TH Sarabun PSK', sans-serif !important; 
        }
        .formal-report-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
        .formal-report-table th, .formal-report-table td {
          height: 44px;
          padding: 0 !important;
          text-align: center !important;
          vertical-align: middle !important;
          line-height: 1 !important;
        }
        .formal-cell-content {
          box-sizing: border-box;
          display: flex;
          width: 100%;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          padding: 4px 6px;
          text-align: center;
          line-height: 1.05;
        }
        .formal-report-table thead .formal-cell-content {
          min-height: 48px;
        }
        .formal-report-table.compact-report-table th,
        .formal-report-table.compact-report-table td {
          height: 28px;
        }
        .formal-report-table.compact-report-table .formal-cell-content {
          min-height: 28px;
          padding: 2px 4px;
        }
        .pdf-export-node { box-sizing: border-box; width: 100%; padding: 24px; background: white; }
        /*
         * html2canvas positions TH Sarabun PSK by its font baseline, which is
         * visually lower than the centre of the line box. Keep the editable
         * preview untouched and compensate only inside the cloned PDF report.
         */
        .pdf-export-node .formal-cell-content {
          position: relative;
          top: -0.5em;
        }
        .avoid-break, .photo-record { break-inside: avoid; page-break-inside: avoid; }
        .page-break-before { break-before: page; page-break-before: always; }
        @page { size: A4 ${
          reportMode === "semester" ? "landscape" : "portrait"
        }; margin: 8mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-reset { overflow: visible !important; display: block !important; position: static !important; transform: none !important; }
          #printable-area { width: 100% !important; max-width: none !important; display: block !important; }
          .screen-only { display: none !important; }
          .print-only { display: inline !important; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          td, th { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white md:p-7">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <span className="mb-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" /> ศูนย์รายงานและส่งออก
              </span>
              <h2 className="text-2xl font-bold">รายงานพร้อมพิมพ์ ใช้ได้ทันที</h2>
              <p className="mt-1 max-w-2xl text-sm text-emerald-50">
                Word, PDF และ Excel เป็นไฟล์มาตรฐาน พร้อมจัดแนวกระดาษและหัวตารางให้เหมาะกับรายงานแต่ละแบบ
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:min-w-[440px]">
              <button
                onClick={exportToExcel}
                disabled={Boolean(exporting)}
                className="group rounded-xl border border-white/20 bg-white p-3 text-left text-slate-800 shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                <FileSpreadsheet className="mb-2 h-5 w-5 text-emerald-600" />
                <span className="block text-sm font-bold">Excel</span>
                <span className="hidden text-[11px] text-slate-500 sm:block">ไฟล์ .xlsx</span>
              </button>
              <button
                onClick={exportToWord}
                disabled={Boolean(exporting)}
                className="group rounded-xl border border-white/20 bg-white p-3 text-left text-slate-800 shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                <FileText className="mb-2 h-5 w-5 text-blue-600" />
                <span className="block text-sm font-bold">Word</span>
                <span className="hidden text-[11px] text-slate-500 sm:block">ไฟล์ .docx</span>
              </button>
              <button
                onClick={printReport}
                disabled={Boolean(exporting) || isPrinting}
                className="group rounded-xl border border-white/20 bg-slate-900 p-3 text-left text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {exporting === "pdf" ? (
                  <Clock className="mb-2 h-5 w-5 animate-spin" />
                ) : (
                  <Printer className="mb-2 h-5 w-5" />
                )}
                <span className="block text-sm font-bold">PDF</span>
                <span className="hidden text-[11px] text-slate-300 sm:block">A4 พร้อมพิมพ์</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 md:p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 xl:w-auto">
              <button
                onClick={() => setReportMode("weekly")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all xl:flex-none ${
                  reportMode === "weekly"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <CalendarDays className="h-4 w-4" /> รายสัปดาห์
              </button>
              <button
                onClick={() => setReportMode("semester")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all xl:flex-none ${
                  reportMode === "semester"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <BarChart3 className="h-4 w-4" /> ภาคเรียน 21 สัปดาห์
              </button>
            </div>

            {reportMode === "weekly" && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <span className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800">
                  <CalendarDays className="h-4 w-4" />
                  วันนี้คือ{currentAcademicWeek >= 1 && currentAcademicWeek <= 21
                    ? `สัปดาห์ที่ ${currentAcademicWeek}`
                    : "ช่วงนอกภาคเรียน"}
                </span>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" /> สัปดาห์ที่แสดง
                  </span>
                  <select
                    value={selectedReportWeek}
                    onChange={(e) =>
                      setSelectedReportWeek(parseInt(e.target.value))
                    }
                    className="max-w-[260px] rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {WEEKS.map((week) => {
                      const dates = getWeekDatesForWeek(week);
                      return (
                        <option key={week} value={week}>
                          สัปดาห์ที่ {week} · {dates[0]} ถึง {dates[4]}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center md:col-span-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-100 bg-emerald-50">
                {schoolLogo ? (
                  <img
                    src={schoolLogo}
                    alt="ตัวอย่างตราโรงเรียน"
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <Camera className="h-7 w-7 text-emerald-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">
                  ตราโรงเรียน / รูปส่วนหัวรายงาน
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  รูปนี้จะแสดงที่ส่วนหัวระบบ หน้าเข้าสู่ระบบ และไฟล์รายงาน PDF/Word
                </p>
              </div>
              <div className="flex gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">
                  <Upload className="h-4 w-4" />
                  {schoolLogo ? "เปลี่ยนรูป" : "ใส่รูป"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleReportLogoUpload}
                  />
                </label>
                {schoolLogo && (
                  <button
                    type="button"
                    onClick={() => setSchoolLogo("")}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" /> ลบรูป
                  </button>
                )}
              </div>
            </div>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-bold text-slate-600">
                วันจันทร์ของสัปดาห์ที่ 1 (วันเปิดภาคเรียน)
              </span>
              <input
                type="date"
                value={settings.semesterStart}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    semesterStart: normalizeToMonday(event.target.value),
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                ระบบใช้วันนี้เป็นหลักนับสัปดาห์ที่ 1–21 และปรับวันที่เลือกให้เป็นวันจันทร์อัตโนมัติ
              </span>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-600">
                ภาคเรียนที่
              </span>
              <select
                value={settings.term}
                onChange={(event) =>
                  setSettings({ ...settings, term: event.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold outline-none focus:border-emerald-500"
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-600">
                ปีการศึกษา
              </span>
              <input
                type="number"
                value={settings.year}
                onChange={(event) =>
                  setSettings({ ...settings, year: event.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          {reportMode === "weekly" && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <TableProperties className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-bold">แก้คะแนนได้จากตารางตัวอย่างด้านล่าง</p>
                <p className="mt-0.5 text-xs text-blue-700">
                  ทุกช่องเลือกคะแนน 0–3 ได้ รวมช่องว่างสีเขียว เมื่อบันทึกแล้วระบบจะอนุมัติและอัปเดตปฏิทินอัตโนมัติ
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              ประธานนักเรียน
            </label>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุล"
              value={settings.president}
              onChange={(e) =>
                setSettings({ ...settings, president: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              ครูกิจการนักเรียน
            </label>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุล"
              value={settings.teacher}
              onChange={(e) =>
                setSettings({ ...settings, teacher: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              ผู้อำนวยการโรงเรียน
            </label>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุล"
              value={settings.director}
              onChange={(e) =>
                setSettings({ ...settings, director: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          </div>
        </div>
      </div>

      {/* 🚀 Wrapper ชั้นนอก ลบเงาและกรอบออกตอนพิมพ์ เพื่อป้องกันขอบล้นใน PDF */}
      <div className="w-full overflow-x-auto print-reset bg-slate-100 py-6 px-2 md:p-8 rounded-xl print:bg-transparent print:p-0 border border-slate-300 print:border-none">
        {/* 🚀 ล็อกกล่องกระดาษไว้ที่ w-full ให้มันหด-ขยายตัวตาม A4 อัตโนมัติ */}
        <div className="w-full min-w-[794px] print:min-w-0 print:w-full mx-auto bg-white shadow-lg print:shadow-none border border-slate-300 print:border-none print-reset">
          <div
            id="printable-area"
            className="font-sarabun text-[16pt] text-black leading-normal w-full p-8 print:p-0 box-border bg-white print-reset"
          >
            <div
              className={`text-center ${
                reportMode === "semester" ? "mb-2" : "mb-6"
              }`}
            >
              {schoolLogo && (
                <img
                  src={schoolLogo}
                  alt="ตราโรงเรียน"
                  className={`mx-auto object-contain ${
                    reportMode === "semester"
                      ? "h-[70px] mb-1"
                      : "h-[90px] mb-3"
                  }`}
                />
              )}
              {reportMode === "weekly" ? (
                <>
                  <h1 className="text-[22pt] font-bold leading-tight">
                    ตารางบันทึกการปฏิบัติงาน
                    <br />
                    ทำความสะอาดเขตพื้นที่รับผิดชอบ
                  </h1>
                  <h2 className="text-[20pt] font-bold mt-1">
                    โรงเรียนไตรธารวิทยา
                  </h2>
                  {/* 🚀 เปลี่ยนรูปแบบวันที่ให้ตรงเป๊ะ: ประจำสัปดาห์ที่ X (ระหว่างวันที่ ...) */}
                  <p className="mt-2 text-[16pt] font-semibold py-1">
                    ประจำสัปดาห์ที่ {selectedReportWeek} (ระหว่างวันที่{" "}
                    {formatThaiDateShort(currentWeekDates[0])} –{" "}
                    {formatThaiDateShort(currentWeekDates[4])})
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-[22pt] font-bold">
                    แบบสรุปผลการประเมินรายภาคเรียน
                  </h1>
                  <h2 className="text-[20pt] font-bold mt-1">
                    โรงเรียนไตรธารวิทยา
                  </h2>
                  <p className="mt-1 text-[16pt]">
                    ประจำภาคเรียนที่ {settings.term} ปีการศึกษา {settings.year}
                  </p>
                </>
              )}
            </div>

            {reportMode === "weekly" && (
              <>
                <div className="mb-6">
                  <table className="formal-report-table w-full border-collapse border border-black text-[16pt]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black py-1 px-2 text-center font-bold w-[40%]">
                          <div className="formal-cell-content">
                            รายการ / เขตพื้นที่
                          </div>
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          <div className="formal-cell-content">จ.</div>
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          <div className="formal-cell-content">อ.</div>
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          <div className="formal-cell-content">พ.</div>
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          <div className="formal-cell-content">พฤ.</div>
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold w-[8%]">
                          <div className="formal-cell-content">ศ.</div>
                        </th>
                        <th className="border border-black py-1 px-2 text-center font-bold bg-slate-200 w-[12%]">
                          <div className="formal-cell-content">รวม</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ZONES.map((zone) => {
                        let total = 0;
                        let hasData = false;
                        return (
                          <tr key={zone.id} className="h-[44px]">
                            <td className="border border-black px-2 py-1.5 text-center align-middle font-bold">
                              <div className="formal-cell-content">
                                {zone.name} {zone.fullClass}
                              </div>
                            </td>
                            {currentWeekDates.map((date) => {
                              const record = inspections.find(
                                (i) =>
                                  Number(i.zoneId) === zone.id &&
                                  formatDateKey(i.date) === date
                              );
                              const approvedRecord =
                                record?.status === "approved" ? record : null;
                              const score = approvedRecord
                                ? approvedRecord.score
                                : "-";
                              const cellKey = `${zone.id}-${date}`;
                              if (score !== "-") {
                                total += Number(score);
                                hasData = true;
                              }
                              return (
                                <td
                                  key={date}
                                  className={`border border-black px-1 py-1.5 text-center align-middle transition-colors ${
                                    cellKey && savedCell === cellKey
                                      ? "bg-emerald-100"
                                      : record?.status === "pending"
                                      ? "bg-amber-50"
                                      : record?.status === "rejected"
                                      ? "bg-red-50"
                                      : approvedRecord
                                      ? "bg-white"
                                      : "bg-emerald-50"
                                  }`}
                                >
                                  <div className="formal-cell-content">
                                    <span className="print-only hidden">
                                      {score}
                                    </span>
                                    <div className="screen-only relative flex items-center justify-center gap-1">
                                      <select
                                        aria-label={`แก้คะแนน ${zone.name} วันที่ ${date}`}
                                        title={
                                          record
                                            ? "แก้คะแนนและอนุมัติข้อมูล พร้อมอัปเดตปฏิทิน"
                                            : "เพิ่มคะแนนช่องว่าง พร้อมอัปเดตปฏิทิน"
                                        }
                                        value={record ? Number(record.score) : ""}
                                        disabled={savingCell === cellKey}
                                        onChange={(event) =>
                                          handleInlineScoreChange(
                                            record,
                                            zone.id,
                                            date,
                                            event.target.value
                                          )
                                        }
                                        className="w-14 cursor-pointer rounded-lg border border-slate-300 bg-white px-1 py-1 text-center font-sans text-sm font-bold text-slate-800 outline-none hover:border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-50"
                                      >
                                        {!record && <option value="">–</option>}
                                        {[0, 1, 2, 3].map((value) => (
                                          <option key={value} value={value}>
                                            {value}
                                          </option>
                                        ))}
                                      </select>
                                      {savingCell === cellKey && (
                                        <Save className="h-3.5 w-3.5 animate-pulse text-amber-600" />
                                      )}
                                      {savedCell === cellKey && (
                                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="border border-black py-1.5 px-2 text-center font-bold">
                              <div className="formal-cell-content">
                                {hasData ? total : "-"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{ pageBreakInside: "avoid" }}
                  className="avoid-break mt-10 w-full flex justify-between gap-4 text-center"
                >
                  <div className="flex flex-col items-center flex-1">
                    <div className="mb-4">
                      ลงชื่อ ..........................................
                    </div>
                    <div className="mb-1">
                      (
                      {settings.president
                        ? ` ${settings.president} `
                        : "........................................"}
                      )
                    </div>
                    <div className="text-[16pt] font-bold mt-1">
                      ประธานนักเรียน
                    </div>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <div className="mb-4">
                      ลงชื่อ ..........................................
                    </div>
                    <div className="mb-1">
                      (
                      {settings.teacher
                        ? ` ${settings.teacher} `
                        : "........................................"}
                      )
                    </div>
                    <div className="text-[16pt] font-bold mt-1">
                      ครูกิจการและพัฒนานักเรียน
                    </div>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <div className="mb-4">
                      ลงชื่อ ..........................................
                    </div>
                    <div className="mb-1">
                      (
                      {settings.director
                        ? ` ${settings.director} `
                        : "........................................"}
                      )
                    </div>
                    <div className="text-[16pt] font-bold mt-1">
                      ผู้อำนวยการโรงเรียนไตรธารวิทยา
                    </div>
                  </div>
                </div>

                <div
                  className="page-break-before mt-12 pt-4"
                  style={{ pageBreakBefore: "always" }}
                >
                  <h2 className="text-[18pt] font-bold pb-2 mb-4">
                    ภาคผนวก: ภาพถ่ายหลักฐานประกอบการตรวจ (สัปดาห์ที่{" "}
                    {selectedReportWeek})
                  </h2>
                  <div className="space-y-4">
                    {weeklyReportData.length === 0 ? (
                      <p className="text-center py-6">
                        ไม่มีข้อมูลรูปภาพในสัปดาห์นี้
                      </p>
                    ) : null}
                    {weeklyReportData.map((item) => {
                      const zone = ZONES.find(
                        (z) => z.id === Number(item.zoneId)
                      );
                      return (
                        <div
                          key={item.id}
                          style={{ pageBreakInside: "avoid" }}
                          className="photo-record mb-2"
                        >
                          <div className="flex justify-between pb-1 mb-1 font-bold text-[15pt]">
                            <span>
                              {zone ? `${zone.name} - ${zone.class}` : ""}{" "}
                              (วันที่: {formatThaiDateShort(item.date)})
                            </span>
                            <span>
                              คะแนน: {item.score}/3{" "}
                              {item.notes && (
                                <span className="font-normal text-slate-700">
                                  | หมายเหตุ: {item.notes}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {item.images &&
                              item.images.map((img, idx) => (
                                <div key={idx} className="text-center">
                                  <img
                                    src={img}
                                    alt="Evidence"
                                    className="w-full h-[140px] object-cover rounded-md border border-slate-300"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "https://placehold.co/400x300?text=No+Image";
                                    }}
                                  />
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {reportMode === "semester" && (
              <div className="mb-4">
                <div>
                  <table className="formal-report-table compact-report-table w-full border-collapse border border-black text-[13pt] print:text-[12pt] leading-tight">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black py-0.5 px-1 text-center font-bold w-[10%]">
                          <div className="formal-cell-content">สัปดาห์ที่</div>
                        </th>
                        {ZONES.map((z) => (
                          <th
                            key={z.id}
                            className="border border-black py-0.5 px-1 text-center font-bold w-[10%]"
                          >
                            <div className="formal-cell-content">{z.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEKS.map((week) => (
                        <tr key={week}>
                          <td className="border border-black py-0.5 px-1 text-center font-bold">
                            <div className="formal-cell-content">{week}</div>
                          </td>
                          {ZONES.map((zone) => {
                            const score = getSemesterScore(week, zone.id);
                            return (
                              <td
                                key={`${week}-${zone.id}`}
                                className="border border-black py-0.5 px-1 text-center"
                              >
                                <div className="formal-cell-content">
                                  {score > 0 ? score : "-"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="font-bold bg-slate-50">
                        <td className="border border-black py-1 px-1 text-center whitespace-nowrap align-middle">
                          <div className="formal-cell-content">รวมคะแนน</div>
                        </td>
                        {ZONES.map((zone) => (
                          <td
                            key={`t-${zone.id}`}
                            className="border border-black py-1 px-1 text-center"
                          >
                            <div className="formal-cell-content">
                              {getZoneTotalSemester(zone.id)}
                            </div>
                          </td>
                        ))}
                      </tr>
                      {/* 🚀 แถวคิดเป็น % */}
                      <tr className="font-bold bg-slate-50">
                        <td className="border border-black py-1 px-1 text-center whitespace-nowrap align-middle">
                          <div className="formal-cell-content">คิดเป็น %</div>
                        </td>
                        {ZONES.map((zone) => {
                          const total = getZoneTotalSemester(zone.id);
                          const percent =
                            total > 0 ? ((total / 315) * 100).toFixed(0) : "-";
                          return (
                            <td
                              key={`p-${zone.id}`}
                              className="border border-black py-1 px-1 text-center"
                            >
                              <div className="formal-cell-content">
                                {percent !== "-" ? `${percent}` : "-"}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  style={{ pageBreakInside: "avoid" }}
                  className="avoid-break mt-6 w-full flex justify-between gap-4"
                >
                  {/* 🚀 กล่องสรุปผล */}
                  <div className="w-[45%] text-[13pt] print:text-[12pt]">
                    {(() => {
                      let ex = 0,
                        gd = 0,
                        fr = 0,
                        im = 0;
                      ZONES.forEach((z) => {
                        const score = getZoneTotalSemester(z.id);
                        const pct = score > 0 ? (score / 315) * 100 : 0;
                        if (pct >= 80) ex++;
                        else if (pct >= 70) gd++;
                        else if (pct >= 50) fr++;
                        else im++;
                      });
                      const totalRooms = ZONES.length;

                      return (
                        <div className="border border-black p-3 bg-white">
                          <p className="font-bold mb-2">สรุปผล:</p>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mb-4 ml-2">
                            <div>ดีเยี่ยม (80 - 100%)</div>
                            <div>
                              {ex} ห้อง (
                              {totalRooms > 0
                                ? ((ex / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>

                            <div>ดี (70 - 79%)</div>
                            <div>
                              {gd} ห้อง (
                              {totalRooms > 0
                                ? ((gd / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>

                            <div>พอใช้ (50 - 69%)</div>
                            <div>
                              {fr} ห้อง (
                              {totalRooms > 0
                                ? ((fr / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>

                            <div>ปรับปรุง (ต่ำกว่า 50%)</div>
                            <div>
                              {im} ห้อง (
                              {totalRooms > 0
                                ? ((im / totalRooms) * 100)
                                    .toFixed(2)
                                    .replace(/\.00$/, "")
                                : 0}
                              %)
                            </div>
                          </div>
                          <p className="font-bold mt-2">หมายเหตุ :</p>
                          <p className="leading-tight mt-1 ml-2">
                            รางวัลเกียรติยศ "ธงเขียว" และ "เกียรติบัตร"
                            จะมอบให้แก่ห้องเรียนที่มีผลการประเมินอยู่ในระดับ
                            "ดีเยี่ยม" (หรือมีคะแนนสูงสุดในรอบการประเมิน)
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="w-[45%] flex flex-col items-center justify-end pb-4">
                    <div className="mb-4 text-[16pt]">
                      ลงชื่อ
                      ...........................................................
                    </div>
                    <div className="mb-1 text-[16pt]">
                      (
                      {settings.headStudentAffairs
                        ? ` ${settings.headStudentAffairs} `
                        : "..........................................................."}
                      )
                    </div>
                    <div className="text-[16pt]">
                      หัวหน้าฝ่ายกิจการและพัฒนานักเรียน / ผู้รับผิดชอบ
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserManagement({
  credentials,
  setCredentials,
  adminCredential,
  setAdminCredential,
}: UserManagementProps) {
  const [newId, setNewId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

  const handleChangeAdminPassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setAdminMessage("");
    if (adminCredential && !currentAdminPassword) {
      setAdminMessage("กรุณากรอกรหัสผ่านแอดมินปัจจุบัน");
      return;
    }
    if (newAdminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      setAdminMessage(
        `รหัสผ่านแอดมินใหม่ต้องมีอย่างน้อย ${MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษร`
      );
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setAdminMessage("ยืนยันรหัสผ่านแอดมินใหม่ไม่ตรงกัน");
      return;
    }

    setIsSavingAdmin(true);
    try {
      if (
        adminCredential &&
        !(await verifyPassword(currentAdminPassword, adminCredential))
      ) {
        setAdminMessage("รหัสผ่านแอดมินปัจจุบันไม่ถูกต้อง");
        return;
      }
      setAdminCredential(await createPasswordVerifier(newAdminPassword));
      setCurrentAdminPassword("");
      setNewAdminPassword("");
      setConfirmAdminPassword("");
      setAdminMessage(
        adminCredential
          ? "เปลี่ยนรหัสผ่านแอดมินสำเร็จ"
          : "ตั้งรหัสผ่านแอดมินสำเร็จ"
      );
    } catch (saveError) {
      setAdminMessage(
        saveError instanceof Error
          ? saveError.message
          : "ตั้งค่ารหัสผ่านแอดมินไม่สำเร็จ"
      );
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedId = newId.trim();
    if (!normalizedId || !newPassword)
      return alert("กรุณากรอกข้อมูลให้ครบ");
    if (!COUNCIL_ACCOUNT_IDS.includes(normalizedId))
      return alert("บัญชีต้องอยู่ระหว่าง สภา01 ถึง สภา09");
    if (newPassword.length < 4)
      return alert("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร");
    const isReplacing = credentials.some((item) => item.id === normalizedId);
    setIsSaving(true);
    try {
      const verifier = await createPasswordVerifier(newPassword);
      setCredentials((current) => {
        const next = [
          ...current.filter((item) => item.id !== normalizedId),
          { id: normalizedId, ...verifier },
        ];
        return next.sort(
          (first, second) =>
            COUNCIL_ACCOUNT_IDS.indexOf(first.id) -
            COUNCIL_ACCOUNT_IDS.indexOf(second.id)
        );
      });
      setNewId("");
      setNewPassword("");
      setStudentMessage(
        isReplacing
          ? "เปลี่ยนรหัสบัญชีและเก็บเฉพาะค่า hash สำเร็จ"
          : "เพิ่มบัญชีและเก็บเฉพาะค่า hash สำเร็จ"
      );
      setTimeout(() => setStudentMessage(""), 2500);
    } catch (saveError) {
      alert(
        saveError instanceof Error
          ? saveError.message
          : "ตั้งค่ารหัสผ่านไม่สำเร็จ"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] print:hidden md:p-7">
        <h2 className="mb-2 flex items-center gap-3 text-xl font-bold text-slate-800">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50">
            <Key className="h-5 w-5 text-emerald-600" />
          </span>
          รหัสผ่านแอดมิน
        </h2>
        <p className="mb-5 pl-0 text-sm leading-relaxed text-slate-500 md:pl-[52px]">
          {adminCredential
            ? "กรอกรหัสปัจจุบันก่อนตั้งรหัสใหม่ การเปลี่ยนแปลงจะมีผลกับการเข้าสู่ระบบครั้งถัดไปบนอุปกรณ์นี้"
            : `ตั้งรหัสผ่านแอดมินอย่างน้อย ${MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษรสำหรับอุปกรณ์นี้`}
        </p>
        {adminMessage && (
          <p className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm font-bold text-amber-800">
            {adminMessage}
          </p>
        )}
        <form
          onSubmit={handleChangeAdminPassword}
          className={`grid gap-4 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-inset ring-slate-100 md:p-5 ${
            adminCredential
              ? "md:grid-cols-2 xl:grid-cols-4"
              : "md:grid-cols-3"
          }`}
        >
          {adminCredential && (
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                รหัสผ่านปัจจุบัน
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentAdminPassword}
                onChange={(event) =>
                  setCurrentAdminPassword(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              รหัสผ่านใหม่
            </label>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_ADMIN_PASSWORD_LENGTH}
              value={newAdminPassword}
              onChange={(event) => setNewAdminPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              ยืนยันรหัสผ่านใหม่
            </label>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_ADMIN_PASSWORD_LENGTH}
              value={confirmAdminPassword}
              onChange={(event) =>
                setConfirmAdminPassword(event.target.value)
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSavingAdmin}
              className="w-full rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-wait disabled:opacity-60"
            >
              {isSavingAdmin
                ? "กำลังบันทึก..."
                : adminCredential
                  ? "เปลี่ยนรหัสแอดมิน"
                  : "ตั้งรหัสแอดมิน"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] print:hidden md:p-7">
        <h2 className="mb-5 flex items-center gap-3 text-xl font-bold text-slate-800">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50">
            <UserPlus className="h-5 w-5 text-emerald-600" />
          </span>
          จัดการรหัสผ่านสภานักเรียน
        </h2>
        {studentMessage && (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            {studentMessage}
          </p>
        )}
        <form
          onSubmit={handleAddUser}
          className="mb-5 grid items-end gap-4 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-inset ring-slate-100 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:p-5"
        >
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              Username
            </label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="เช่น สภา02"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="รหัสผ่าน"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? "กำลังบันทึก..." : "เพิ่ม / เปลี่ยนรหัส"}
          </button>
        </form>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full min-w-[560px] bg-white text-left">
            <thead>
              <tr className="bg-slate-50 text-sm text-slate-600">
                <th className="p-3.5">ลำดับ</th>
                <th className="p-3.5">Username</th>
                <th className="p-3.5">สถานะรหัส</th>
                <th className="p-3.5 text-center">ลบ</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/60"
                >
                  <td className="p-3.5 text-slate-500">{i + 1}</td>
                  <td className="p-3.5 font-bold text-slate-700">{c.id}</td>
                  <td className="p-3.5">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      ตั้งค่าแล้ว (PBKDF2)
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() =>
                        setCredentials((current) =>
                          current.filter((user) => user.id !== c.id)
                        )
                      }
                      aria-label={`ลบบัญชี ${c.id}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
