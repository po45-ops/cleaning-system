/**
 * โหลดรูปสำหรับไฟล์รายงาน (Word / PDF) ให้เสถียร
 *
 * - ดึงรูปแต่ละ URL ครั้งเดียวแล้วเก็บแคชไว้ ใช้ซ้ำได้ทั้ง Word และ PDF
 * - จำกัดการดึงพร้อมกัน เพราะ Google (lh3.googleusercontent.com) ตอบ 429
 *   เมื่อขอรูปจำนวนมากพร้อมกัน และลองใหม่อัตโนมัติเมื่อโดนจำกัด
 * - แปลงทุกรูปเป็น JPEG/PNG ขนาดพอดีพิมพ์ Word เปิดได้แน่นอน (ไม่มี WebP)
 *   และไฟล์ไม่บวมจากรูปต้นฉบับขนาดใหญ่
 */

export type ReportImage = {
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
};

const MAX_CONCURRENT = 3;
const MAX_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_EDGE_PX = 1000;

const cache = new Map<string, Promise<ReportImage | null>>();
let active = 0;
const waiting: Array<() => void> = [];

const acquire = (): Promise<void> =>
  new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active += 1;
      resolve();
    } else {
      waiting.push(() => {
        active += 1;
        resolve();
      });
    }
  });

const release = (): void => {
  active -= 1;
  const next = waiting.shift();
  if (next) next();
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const dataUrlToBytes = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const fetchBlob = async (source: string): Promise<Blob> => {
  if (source.startsWith("data:")) {
    return (await fetch(source)).blob();
  }
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(source, {
        signal: controller.signal,
        mode: "cors",
        credentials: "omit",
      });
      if (response.ok) return await response.blob();
      lastError = new Error(`HTTP ${response.status}`);
      // 4xx อื่นนอกจาก 429 (เช่นไฟล์ถูกลบ) ลองใหม่ก็ไม่หาย
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS - 1) await sleep(700 * 2 ** attempt + Math.random() * 300);
  }
  throw lastError instanceof Error ? lastError : new Error("โหลดรูปไม่สำเร็จ");
};

const decode = async (
  blob: Blob
): Promise<{ draw: CanvasImageSource; width: number; height: number; close: () => void }> => {
  if (typeof createImageBitmap === "function") {
    // imageOrientation ให้รูปที่ถ่ายแนวตั้งจากมือถือไม่ตะแคง
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { draw: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("เปิดรูปไม่สำเร็จ"));
    image.src = url;
  });
  return {
    draw: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
};

const loadOnce = async (source: string, keepTransparency: boolean): Promise<ReportImage | null> => {
  await acquire();
  try {
    const blob = await fetchBlob(source);
    const decoded = await decode(blob);
    try {
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      if (!keepTransparency) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(decoded.draw, 0, 0, width, height);
      const dataUrl = keepTransparency
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.85);
      return { dataUrl, bytes: dataUrlToBytes(dataUrl), width, height };
    } finally {
      decoded.close();
    }
  } catch (error) {
    console.warn("Unable to load report image", source, error);
    return null;
  } finally {
    release();
  }
};

/** โหลดรูปสำหรับรายงาน คืน null ถ้าโหลดไม่ได้ (ไม่ throw) */
export const loadReportImage = (
  source: string,
  { keepTransparency = false }: { keepTransparency?: boolean } = {}
): Promise<ReportImage | null> => {
  if (!source) return Promise.resolve(null);
  const key = `${keepTransparency ? "png" : "jpg"}|${source}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = loadOnce(source, keepTransparency);
    cache.set(key, pending);
    // รูปที่โหลดไม่ได้ ไม่เก็บแคชถาวร กดส่งออกครั้งถัดไปจะลองใหม่
    void pending.then((result) => {
      if (!result) cache.delete(key);
    });
  }
  return pending;
};

/** ป้ายแทนรูปที่โหลดไม่ได้ เป็นรูปฝังในหน้า ไม่พึ่งเว็บภายนอก */
export const MISSING_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="#f1f5f9"/>' +
      '<text x="200" y="160" font-family="sans-serif" font-size="30" fill="#94a3b8" text-anchor="middle">ไม่มีรูปภาพ</text>' +
      "</svg>"
  );

/** ใช้เฉพาะในชุดทดสอบ */
export const __resetReportImageCache = (): void => {
  cache.clear();
};
