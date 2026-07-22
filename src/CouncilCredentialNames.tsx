import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Users } from "lucide-react";

type CouncilAccountOwner = {
  accountId: string;
  homeClass: string;
  members: string[];
};

const COUNCIL_ACCOUNT_OWNERS: CouncilAccountOwner[] = [
  { accountId: "สภา01", homeClass: "ม.3", members: ["จิราพร", "ธนวัฒน์"] },
  { accountId: "สภา02", homeClass: "ม.2", members: ["ศิริพงษ์", "ภาณุวัฒน์"] },
  { accountId: "สภา03", homeClass: "ป.2", members: ["พงศพัศ", "มงคลเทพ"] },
  { accountId: "สภา04", homeClass: "ป.3", members: ["วรัชญา", "มหายศนันท์"] },
  { accountId: "สภา05", homeClass: "ป.1", members: ["อรพิมพ์", "อโณทัย"] },
  { accountId: "สภา06", homeClass: "ป.5", members: ["เอเชีย", "ภูผา"] },
  {
    accountId: "สภา07",
    homeClass: "ป.4",
    members: ["ศุภกร", "ชนวีร์", "จารุวัฒน์"],
  },
  { accountId: "สภา08", homeClass: "ป.6", members: ["วีรัช", "วุฒิชัย"] },
  { accountId: "สภา09", homeClass: "ม.1", members: ["นพวิทย์", "อนุวัฒน์"] },
];

const findPasswordSection = (): HTMLElement | null => {
  const heading = Array.from(document.querySelectorAll("h1, h2, h3")).find(
    (element) =>
      element.textContent?.includes("จัดการรหัสผ่านสภานักเรียน")
  );

  return heading?.parentElement instanceof HTMLElement
    ? heading.parentElement
    : null;
};

/**
 * แสดงรายชื่อนักเรียนผู้รับผิดชอบแต่ละบัญชีไว้ท้ายหน้าจัดการรหัสผ่าน
 * โดยใช้ Portal เพื่อไม่ต้องแก้โครงสร้างหน้าหลักขนาดใหญ่ใน App.tsx
 */
export default function CouncilCredentialNames(): JSX.Element | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frameId = 0;

    const refreshTarget = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextTarget = findPasswordSection();
        setTarget((currentTarget) =>
          currentTarget === nextTarget ? currentTarget : nextTarget
        );
      });
    };

    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <section className="mt-6 border-t border-slate-200 pt-5">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="rounded-lg bg-emerald-600 p-2 text-white">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-emerald-900">
            รายชื่อนักเรียนผู้รับผิดชอบแต่ละบัญชี
          </h3>
          <p className="mt-1 text-sm text-emerald-800">
            ใช้ตรวจสอบได้ทันทีว่า Username และงานที่ส่งเป็นของนักเรียนกลุ่มใด
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-slate-100 text-sm text-slate-700">
            <tr>
              <th className="p-3">ลำดับ</th>
              <th className="p-3">Username</th>
              <th className="p-3">ชั้น</th>
              <th className="p-3">รายชื่อนักเรียน</th>
            </tr>
          </thead>
          <tbody>
            {COUNCIL_ACCOUNT_OWNERS.map((account, index) => (
              <tr
                key={account.accountId}
                className="border-t border-slate-100 bg-white"
              >
                <td className="p-3 text-slate-500">{index + 1}</td>
                <td className="p-3 font-bold text-emerald-700">
                  {account.accountId}
                </td>
                <td className="p-3 font-semibold text-slate-700">
                  {account.homeClass}
                </td>
                <td className="p-3 text-slate-700">
                  {account.members.join(" • ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>,
    target
  );
}
