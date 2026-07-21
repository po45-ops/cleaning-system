import { useEffect } from "react";

type StudentCredential = {
  id: string;
  password: string;
};

const CREDENTIALS_KEY = "cleaning_student_creds";
const MIGRATION_KEY = "cleaning_student_creds_seed_9_groups_v1";

const DEFAULT_COUNCIL_CREDENTIALS: StudentCredential[] = [
  { id: "สภา01", password: "1234" }, // กลุ่ม ม.3: จิราพร, ธนวัฒน์
  { id: "สภา02", password: "1234" }, // กลุ่ม ม.2: ศิริพงษ์, ภาณุวัฒน์
  { id: "สภา03", password: "1234" }, // กลุ่ม ป.2: พงศพัศ, มงคลเทพ
  { id: "สภา04", password: "1234" }, // กลุ่ม ป.3: วรัชญา, มหายศนันท์
  { id: "สภา05", password: "1234" }, // กลุ่ม ป.1: อรพิมพ์, อโณทัย
  { id: "สภา06", password: "1234" }, // กลุ่ม ป.5: เอเชีย, ภูผา
  { id: "สภา07", password: "1234" }, // กลุ่ม ป.4: ศุภกร, ชนวีร์, จารุวัฒน์
  { id: "สภา08", password: "1234" }, // กลุ่ม ป.6: วีรัช, วุฒิชัย
  { id: "สภา09", password: "1234" }, // กลุ่ม ม.1: นพวิทย์, อนุวัฒน์
];

const readCredentials = (): StudentCredential[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StudentCredential =>
        Boolean(item) &&
        typeof item.id === "string" &&
        typeof item.password === "string"
    );
  } catch {
    return [];
  }
};

/**
 * เพิ่มบัญชีล็อกอินเริ่มต้นให้ครบ 9 กลุ่มเพียงครั้งเดียว
 * โดยเก็บรหัสของบัญชีเดิมไว้ และเติมเฉพาะบัญชีที่ยังไม่มี
 */
export default function CouncilCredentialBootstrap(): null {
  useEffect(() => {
    if (localStorage.getItem(MIGRATION_KEY) === "done") return;

    const timerId = window.setTimeout(() => {
      const existing = readCredentials();
      const existingIds = new Set(
        existing.map((item) => item.id.trim().toLowerCase())
      );
      const missing = DEFAULT_COUNCIL_CREDENTIALS.filter(
        (item) => !existingIds.has(item.id.toLowerCase())
      );

      if (missing.length > 0) {
        localStorage.setItem(
          CREDENTIALS_KEY,
          JSON.stringify([...existing, ...missing])
        );
      }
      localStorage.setItem(MIGRATION_KEY, "done");

      if (missing.length > 0) {
        window.location.reload();
      }
    }, 150);

    return () => window.clearTimeout(timerId);
  }, []);

  return null;
}
