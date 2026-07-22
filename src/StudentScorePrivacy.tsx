import { useEffect } from "react";

const AUTH_KEY = "cleaning_auth_user";
const SCORE_TEXT_MARKER = "studentScoreText";
const SCORE_HIDDEN_MARKER = "studentScoreHidden";

const getCurrentRole = (): string => {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    return String(user?.role || "").trim().toLowerCase();
  } catch {
    return "";
  }
};

const restoreScoreVisibility = (): void => {
  document
    .querySelectorAll<HTMLElement>("[data-student-score-text='true']")
    .forEach((element) => {
      const original = element.dataset.studentScoreOriginal;
      if (typeof original === "string") element.textContent = original;
      delete element.dataset[SCORE_TEXT_MARKER];
      delete element.dataset.studentScoreOriginal;
    });

  document
    .querySelectorAll<HTMLElement>("[data-student-score-hidden='true']")
    .forEach((element) => {
      element.style.display = element.dataset.studentScoreDisplay || "";
      delete element.dataset[SCORE_HIDDEN_MARKER];
      delete element.dataset.studentScoreDisplay;
    });
};

const replaceCalendarScoreText = (): void => {
  document.querySelectorAll<HTMLElement>("p").forEach((element) => {
    const text = element.textContent?.trim() || "";
    const isCalendarScore =
      text.startsWith("บันทึกแล้ว") && text.includes("คะแนน");

    if (!isCalendarScore) return;

    if (element.dataset.studentScoreText !== "true") {
      element.dataset.studentScoreText = "true";
      element.dataset.studentScoreOriginal = text;
    } else if (text !== "บันทึกแล้ว") {
      element.dataset.studentScoreOriginal = text;
    }

    if (element.textContent !== "บันทึกแล้ว") {
      element.textContent = "บันทึกแล้ว";
    }
  });
};

const hideElement = (element?: HTMLElement | null): void => {
  if (!element || element.dataset.studentScoreHidden === "true") return;

  element.dataset.studentScoreHidden = "true";
  element.dataset.studentScoreDisplay = element.style.display;
  element.style.display = "none";
};

const hideStatusPageScores = (): void => {
  document.querySelectorAll<HTMLElement>("span").forEach((element) => {
    const text = element.textContent?.trim() || "";

    if (text.startsWith("คะแนนที่สภาประเมิน:")) {
      hideElement(element.closest<HTMLElement>("div.mb-3") || element.parentElement);
      return;
    }

    if (/^คะแนน:\s*\d/.test(text)) {
      hideElement(element);
    }
  });
};

const applyStudentScorePrivacy = (): void => {
  if (getCurrentRole() !== "student") {
    restoreScoreVisibility();
    return;
  }

  replaceCalendarScoreText();
  hideStatusPageScores();
};

/**
 * ซ่อนคะแนนเฉพาะข้อมูลที่แสดงหลังส่งงานในโหมดสภานักเรียน
 * โดยยังคงเกณฑ์เลือกคะแนนในหน้าบันทึกผลไว้ตามเดิม
 * และคืนค่าคะแนนทั้งหมดทันทีเมื่อเข้าโหมดครู/แอดมิน
 */
export default function StudentScorePrivacy(): null {
  useEffect(() => {
    let frameId = 0;

    const refresh = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(applyStudentScorePrivacy);
    };

    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const intervalId = window.setInterval(refresh, 600);
    window.addEventListener("storage", refresh);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
      window.removeEventListener("storage", refresh);
      observer.disconnect();
      restoreScoreVisibility();
    };
  }, []);

  return null;
}
