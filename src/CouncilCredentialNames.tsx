import { useEffect } from "react";

type CouncilAccountOwner = {
  accountId: string;
  members: string[];
};

const COUNCIL_ACCOUNT_OWNERS: CouncilAccountOwner[] = [
  { accountId: "สภา01", members: ["จิราพร", "ธนวัฒน์"] },
  { accountId: "สภา02", members: ["ศิริพงษ์", "ภาณุวัฒน์"] },
  { accountId: "สภา03", members: ["พงศพัศ", "มงคลเทพ"] },
  { accountId: "สภา04", members: ["วรัชญา", "มหายศนันท์"] },
  { accountId: "สภา05", members: ["อรพิมพ์", "อโณทัย"] },
  { accountId: "สภา06", members: ["เอเชีย", "ภูผา"] },
  { accountId: "สภา07", members: ["ศุภกร", "ชนวีร์", "จารุวัฒน์"] },
  { accountId: "สภา08", members: ["วีรัช", "วุฒิชัย"] },
  { accountId: "สภา09", members: ["นพวิทย์", "อนุวัฒน์"] },
];

const OWNER_BY_ACCOUNT = new Map(
  COUNCIL_ACCOUNT_OWNERS.map((owner, index) => [
    owner.accountId.toLowerCase(),
    { ...owner, groupNumber: index + 1 },
  ])
);

const patchCredentialTable = (): void => {
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("h1, h2, h3")
  ).find((element) =>
    element.textContent?.includes("จัดการรหัสผ่านสภานักเรียน")
  );
  const section = heading?.parentElement;
  const table = section?.querySelector<HTMLTableElement>("table");
  if (!table) return;

  table.classList.add("min-w-[850px]");

  const headerRow = table.querySelector<HTMLTableRowElement>("thead tr");
  if (headerRow && !headerRow.querySelector("[data-council-owner-header]")) {
    const ownerHeader = document.createElement("th");
    ownerHeader.dataset.councilOwnerHeader = "true";
    ownerHeader.className = "p-3 min-w-[300px]";
    ownerHeader.textContent = "กลุ่มและรายชื่อนักเรียนผู้ตรวจเวร";
    headerRow.insertBefore(ownerHeader, headerRow.lastElementChild);
  }

  table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    const accountId = cells[1]?.textContent?.trim().toLowerCase() || "";
    const owner = OWNER_BY_ACCOUNT.get(accountId);
    let ownerCell = row.querySelector<HTMLTableCellElement>(
      "[data-council-owner-cell]"
    );

    if (!ownerCell) {
      ownerCell = document.createElement("td");
      ownerCell.dataset.councilOwnerCell = "true";
      ownerCell.className = "p-3 min-w-[300px] text-slate-700";
      row.insertBefore(ownerCell, row.lastElementChild);
    }

    const nextText = owner
      ? `กลุ่มที่ ${owner.groupNumber}: ${owner.members.join(" • ")}`
      : "ยังไม่ได้ระบุรายชื่อนักเรียนผู้รับผิดชอบ";

    if (ownerCell.textContent !== nextText) {
      ownerCell.textContent = nextText;
      ownerCell.className = owner
        ? "p-3 min-w-[300px] font-semibold text-slate-700"
        : "p-3 min-w-[300px] text-sm text-amber-600";
    }
  });
};

const getScheduleTable = (): HTMLTableElement | undefined =>
  Array.from(document.querySelectorAll<HTMLTableElement>("table")).find(
    (table) =>
      Array.from(table.querySelectorAll("th")).some(
        (header) => header.textContent?.trim() === "กลุ่มผู้ตรวจ"
      )
  );

const replaceGroupLabel = (
  element: HTMLElement,
  groupNumber: number
): void => {
  const expected = `กลุ่มที่ ${groupNumber}`;
  const currentText = element.textContent?.trim() || "";

  if (
    element.dataset.councilGroupNumber === String(groupNumber) &&
    currentText.startsWith(expected)
  ) {
    return;
  }

  // JSX แยกคำว่า “กลุ่ม” และค่าชั้นเป็นคนละ text node
  // จึงต้องแทนที่ text node ทั้งหมด ไม่ใช่แก้เพียง node แรก
  const trailingElements = Array.from(element.children);
  element.replaceChildren(
    document.createTextNode(`${expected} `),
    ...trailingElements
  );
  element.dataset.councilGroupNumber = String(groupNumber);
};

const findGroupLabel = (
  firstCell: HTMLTableCellElement
): HTMLElement | undefined => {
  const primary = firstCell.querySelector<HTMLElement>(
    "div.font-black.text-slate-900"
  );
  if (primary) return primary;

  return Array.from(firstCell.querySelectorAll<HTMLElement>("div")).find(
    (element) => /^กลุ่ม(?:ที่)?\s/.test(element.textContent?.trim() || "")
  );
};

const getOwnGroupNumber = (
  rows: HTMLTableRowElement[],
  authAccount: string
): number | undefined => {
  const highlightedIndex = rows.findIndex((row) =>
    Array.from(row.querySelectorAll("span")).some(
      (span) => span.textContent?.trim() === "กลุ่มของคุณ"
    )
  );
  if (highlightedIndex >= 0) return highlightedIndex + 1;

  const accountIndex = rows.findIndex((row) => {
    const accountText = Array.from(row.querySelectorAll<HTMLElement>("div")).find(
      (element) => element.textContent?.trim().startsWith("บัญชี:")
    )?.textContent;
    const accountId = accountText?.replace(/^บัญชี:\s*/, "").trim().toLowerCase();
    return Boolean(authAccount) && accountId === authAccount;
  });
  if (accountIndex >= 0) return accountIndex + 1;

  return OWNER_BY_ACCOUNT.get(authAccount)?.groupNumber;
};

const patchOwnDutyHeading = (groupNumber?: number): void => {
  if (!groupNumber) return;

  const dutyLabel = Array.from(document.querySelectorAll<HTMLElement>("p")).find(
    (element) => element.textContent?.trim() === "หน้าที่ของกลุ่มคุณ"
  );
  const heading = dutyLabel?.parentElement?.querySelector<HTMLElement>("h3");
  if (!heading) return;

  const currentText = heading.textContent?.trim() || "";
  const membersText = currentText.includes(":")
    ? currentText.split(":").slice(1).join(":").trim()
    : OWNER_BY_ACCOUNT.get(
        String(
          (() => {
            try {
              const auth = JSON.parse(
                localStorage.getItem("cleaning_auth_user") || "null"
              );
              return auth?.id || "";
            } catch {
              return "";
            }
          })()
        )
          .trim()
          .toLowerCase()
      )?.members.join(" • ") || "ยังไม่มีรายชื่อสมาชิก";

  const nextText = `กลุ่มที่ ${groupNumber}: ${membersText}`;
  if (heading.textContent !== nextText) {
    heading.textContent = nextText;
  }
};

const patchScheduleGroupNames = (): void => {
  const scheduleTable = getScheduleTable();
  if (!scheduleTable) return;

  const rows = Array.from(
    scheduleTable.querySelectorAll<HTMLTableRowElement>("tbody tr")
  );

  rows.forEach((row, index) => {
    const firstCell = row.querySelector<HTMLTableCellElement>("td");
    if (!firstCell) return;

    const groupLabel = findGroupLabel(firstCell);
    if (groupLabel) replaceGroupLabel(groupLabel, index + 1);
  });

  let authAccount = "";
  try {
    const auth = JSON.parse(localStorage.getItem("cleaning_auth_user") || "null");
    authAccount = String(auth?.id || "").trim().toLowerCase();
  } catch {
    authAccount = "";
  }

  patchOwnDutyHeading(getOwnGroupNumber(rows, authAccount));
};

/**
 * 1) เติมรายชื่อผู้รับผิดชอบต่อท้ายตารางรหัสผ่านเดิม
 * 2) แก้กล่อง “หน้าที่ของกลุ่มคุณ” และชื่อแถวในตารางหมุนเวียน
 *    ให้ใช้ “กลุ่มที่ 1–9” ตรงกับบัญชีรหัสผ่าน
 */
export default function CouncilCredentialNames(): null {
  useEffect(() => {
    let frameId = 0;

    const patchScreen = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        patchCredentialTable();
        patchScheduleGroupNames();
      });
    };

    patchScreen();
    const observer = new MutationObserver(patchScreen);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    // สำรองกรณี React อัปเดต DOM โดยไม่เกิด mutation ที่จุดชื่อกลุ่ม
    const intervalId = window.setInterval(patchScreen, 800);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
      observer.disconnect();
      document
        .querySelectorAll("[data-council-owner-header], [data-council-owner-cell]")
        .forEach((element) => element.remove());
    };
  }, []);

  return null;
}
