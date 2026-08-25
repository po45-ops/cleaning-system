const DATE_GUARD_FLAG = "__cleaningDateInputGuardInstalled";
const WEEKDAY_ALERT_TEXT = "วันจันทร์ - วันศุกร์";
const WEEKDAY_TOAST_ID = "cleaning-weekday-date-notice";

type DateGuardGlobal = typeof globalThis & {
  __cleaningDateInputGuardInstalled?: boolean;
};

let toastTimer: number | null = null;

const showWeekdayDateNotice = (): void => {
  let notice = document.getElementById(WEEKDAY_TOAST_ID) as HTMLDivElement | null;

  if (!notice) {
    notice = document.createElement("div");
    notice.id = WEEKDAY_TOAST_ID;
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    Object.assign(notice.style, {
      position: "fixed",
      top: "88px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "9999",
      maxWidth: "min(92vw, 520px)",
      padding: "12px 16px",
      borderRadius: "14px",
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#92400e",
      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.16)",
      fontSize: "14px",
      fontWeight: "700",
      lineHeight: "1.45",
      textAlign: "center",
      pointerEvents: "none",
    });
    document.body.appendChild(notice);
  }

  notice.textContent =
    "วันที่ที่เลือกเป็นวันเสาร์หรืออาทิตย์ — เลือกวันที่ย้อนหลังได้ตามปกติ หากเป็นวันจันทร์–วันศุกร์ และไม่เกินวันนี้";
  notice.style.display = "block";

  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    notice?.remove();
    toastTimer = null;
  }, 3600);
};

/**
 * Browser Date parsing treats a bare YYYY-MM-DD string as UTC.  Date inputs,
 * however, represent a local calendar date.  Parse only those date-only values
 * as local noon so weekday checks cannot move to a neighbouring day because of
 * timezone/DST differences.  Other Date constructor behaviour is untouched.
 */
const installLocalDateOnlyParsing = (): void => {
  const NativeDate = globalThis.Date;

  const LocalDate = new Proxy(NativeDate, {
    construct(target, args) {
      if (
        args.length === 1 &&
        typeof args[0] === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(args[0])
      ) {
        const [year, month, day] = args[0].split("-").map(Number);
        return new target(year, month - 1, day, 12, 0, 0, 0);
      }

      return Reflect.construct(target, args);
    },
  });

  globalThis.Date = LocalDate as DateConstructor;
};

const installWeekdayAlertUx = (): void => {
  const nativeAlert = window.alert.bind(window);

  window.alert = (message?: unknown): void => {
    const text = String(message ?? "");
    if (text.includes("กรุณาเลือกเฉพาะ") && text.includes(WEEKDAY_ALERT_TEXT)) {
      showWeekdayDateNotice();
      return;
    }

    nativeAlert(message);
  };
};

export const installDateInputGuard = (): void => {
  const guardGlobal = globalThis as DateGuardGlobal;
  if (guardGlobal[DATE_GUARD_FLAG as keyof DateGuardGlobal]) return;

  guardGlobal.__cleaningDateInputGuardInstalled = true;
  installLocalDateOnlyParsing();
  installWeekdayAlertUx();
};
