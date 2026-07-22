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

const replaceLeadingGroupLabel = (
  element: HTMLElement,
  groupNumber: number
): void => {
  const expected = `กลุ่มที่ ${groupNumber}`;
  const textNode = Array.from(element.childNodes).find(
    (node) =>
      node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  );

  if (textNode) {
    const current = textNode.textContent?.trim() || "";
    if (current !== expected) textNode.textContent = `${expected} `;
  }
};

const patchScheduleGroupNames = (): void => {
  const scheduleTable = Array.from(
    document.querySelectorAll<HTMLTableElement>("table")
  ).find((table) =>
    Array.from(table.querySelectorAll("th")).some(
      (header) => header.textContent?.trim() === "กลุ่มผู้ตรวจ"
    )
  );

  scheduleTable
    ?.querySelectorAll<HTMLTableRowElement>("tbody tr")
    .forEach((row, index) => {
      const firstCell = row.querySelector<HTMLTableCellElement>("td");
      const groupLabel = firstCell
        ? Array.from(firstCell.querySelectorAll<HTMLElement>("div")).find(
            (element) =>
              /^กลุ่ม\s+(?:ป|ม)\.\d/.test(element.textContent?.trim() || "") ||
              /^กลุ่มที่\s+\d+/.test(element.textContent?.trim() || "")
          )
        : undefined;

      if (groupLabel) replaceLeadingGroupLabel(groupLabel, index + 1);
    });

  let authAccount = "";
  try {
    const auth = JSON.parse(localStorage.getItem("cleaning_auth_user") || "null");
    authAccount = String(auth?.id || "").trim().toLowerCase();
  } catch {
    authAccount = "";
  }

  const owner = OWNER_BY_ACCOUNT.get(authAccount);
  if (!owner) return;

  const ownGroupHeading = Array.from(
    document.querySelectorAll<HTMLElement>("h3")
  ).find((element) =>
    /^กลุ่ม\s+(?:ป|ม)\.\d\s*:/.test(element.textContent?.trim() || "")
  );

  if (ownGroupHeading) {
    const nextText = `กลุ่มที่ ${owner.groupNumber}: ${owner.members.join(" • ")}`;
    if (ownGroupHeading.textContent !== nextText) {
      ownGroupHeading.textContent = nextText;
    }
  }
};

/**
 * เติมรายชื่อผู้รับผิดชอบเป็นคอลัมน์ต่อท้ายตารางรหัสผ่านเดิม
 * และแก้ชื่อกลุ่มในตารางจัดเวรจากชื่อชั้นเป็น “กลุ่มที่ 1–9”
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

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      document
        .querySelectorAll("[data-council-owner-header], [data-council-owner-cell]")
        .forEach((element) => element.remove());
    };
  }, []);

  return null;
}
