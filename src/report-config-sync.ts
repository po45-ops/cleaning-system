/** ซิงก์ตั้งค่ารายงาน (ชื่อผู้ลงนาม ภาคเรียน ตราโรงเรียน) ไปเก็บกลางบน Apps Script */
const API_URL =
  "https://script.google.com/macros/s/AKfycbwfmqSlIqJ0-2CoAQ1Uv7nrL47x3zsqToUWP0brNiHBnJGFIvz450w33ANBmltvOjNPTg/exec";

export type ReportConfigPayload = {
  settings: Record<string, string>;
  logo: string;
  updatedAt: number;
};

export const fetchReportConfig = async (): Promise<ReportConfigPayload | null> => {
  const response = await fetch(
    `${API_URL}?action=getReportConfig&refresh=${Date.now()}`,
    { method: "GET", cache: "no-store" }
  );
  const result = (await response.json()) as {
    status?: string;
    message?: string;
    data?: ReportConfigPayload | null;
  };
  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "อ่านตั้งค่ารายงานจากระบบไม่สำเร็จ");
  }
  const data = result.data;
  if (!data || typeof data !== "object" || !data.settings) return null;
  return {
    settings: data.settings,
    logo: typeof data.logo === "string" ? data.logo : "",
    updatedAt: Number(data.updatedAt) || 0,
  };
};

export const saveReportConfig = async (
  config: ReportConfigPayload
): Promise<void> => {
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "saveReportConfig", ...config }),
  });
  // Apps Script ตอบผ่าน redirect จึงอ่านผลตรงไม่ได้ ให้ตรวจยืนยันด้วย GET
  const saved = await fetchReportConfig();
  if (!saved || saved.updatedAt !== config.updatedAt) {
    throw new Error("ส่งข้อมูลแล้ว แต่ตรวจยืนยันไม่สำเร็จ");
  }
};
