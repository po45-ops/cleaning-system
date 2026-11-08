/** ไฟล์ PDF ฉบับเต็มของแต่ละภาคเรียนบน Google Drive (ลิงก์คงที่ อัปโหลดใหม่แล้วแทนที่ไฟล์เดิม) */
const API_URL =
  "https://script.google.com/macros/s/AKfycbwfmqSlIqJ0-2CoAQ1Uv7nrL47x3zsqToUWP0brNiHBnJGFIvz450w33ANBmltvOjNPTg/exec";

export type ReportPdfLink = {
  url: string;
  ready: boolean;
  size: number;
  updatedAt: number;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const fetchReportPdfLink = async (term: string, year: string): Promise<ReportPdfLink | null> => {
  const query = new URLSearchParams({ action: "getReportPdfLink", term, year, refresh: String(Date.now()) });
  const response = await fetch(`${API_URL}?${query.toString()}`, { method: "GET", cache: "no-store" });
  const result = (await response.json()) as { status?: string; message?: string; data?: ReportPdfLink | null };
  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "อ่านลิงก์ไฟล์รายงานไม่สำเร็จ");
  }
  const data = result.data;
  if (!data || typeof data.url !== "string" || !data.url) return null;
  return {
    url: data.url,
    ready: Boolean(data.ready),
    size: Number(data.size) || 0,
    updatedAt: Number(data.updatedAt) || 0,
  };
};

/** สร้างไฟล์ที่ลิงก์คงที่ไว้ก่อน (ถ้ายังไม่มี) แล้วคืนลิงก์ — คืน null ถ้าทำไม่สำเร็จ */
export const prepareReportPdfLink = async (term: string, year: string): Promise<ReportPdfLink | null> => {
  try {
    const existing = await fetchReportPdfLink(term, year);
    if (existing) return existing;
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "prepareReportPdf", term, year }),
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await wait(1500);
      const created = await fetchReportPdfLink(term, year);
      if (created) return created;
    }
  } catch (error) {
    console.warn("เตรียมลิงก์ไฟล์รายงานไม่สำเร็จ", error);
  }
  return null;
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });

export const MAX_REPORT_PDF_BYTES = 33 * 1024 * 1024;

/** อัปโหลด PDF ไปแทนที่ไฟล์เดิม แล้วตรวจยืนยันจากขนาดไฟล์บน Drive */
export const uploadReportPdf = async (term: string, year: string, pdf: Blob): Promise<boolean> => {
  const data = await blobToBase64(pdf);
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action: "saveReportPdf", term, year, data }),
  });
  for (let attempt = 0; attempt < 14; attempt += 1) {
    await wait(3000);
    try {
      const link = await fetchReportPdfLink(term, year);
      if (link && link.ready && link.size === pdf.size) return true;
    } catch {
      // ลองตรวจใหม่
    }
  }
  return false;
};
