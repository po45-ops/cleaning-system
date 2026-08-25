import React, { StrictMode, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import CouncilCredentialNames from "./CouncilCredentialNames";
import CouncilScheduleWidget from "./CouncilScheduleWidget";
import OverviewActionsRemover from "./OverviewActionsRemover";
import SemesterLeaderboard from "./SemesterLeaderboard";
import StudentScorePrivacy from "./StudentScorePrivacy";
import { installDateInputGuard } from "./date-input-guard";
import { installInspectionSyncGuard } from "./inspection-sync-guard";
import "./styles.css";

function DefaultLoginEntry() {
  const didOpenLogin = useRef(false);

  useLayoutEffect(() => {
    if (didOpenLogin.current) return;

    const loginButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) =>
      button.textContent?.includes("เข้าสู่ระบบเจ้าหน้าที่")
    );

    if (!loginButton) return;

    didOpenLogin.current = true;
    loginButton.click();
  }, []);

  useLayoutEffect(() => {
    const currentLabel = "กลับไปดูภาพรวมสาธารณะ";
    const newLabel = "ดูภาพรวมวันนี้";

    const updatePublicOverviewButton = () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).forEach(
        (button) => {
          if (!button.textContent?.includes(currentLabel)) return;

          Array.from(button.childNodes).forEach((node) => {
            if (
              node.nodeType === Node.TEXT_NODE &&
              node.textContent?.includes(currentLabel)
            ) {
              node.textContent = ` ${newLabel}`;
            }
          });
        }
      );
    };

    updatePublicOverviewButton();

    const observer = new MutationObserver(updatePublicOverviewButton);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return <App />;
}

installDateInputGuard();
installInspectionSyncGuard();

const rootElement = document.getElementById("root");
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <DefaultLoginEntry />
    <CouncilCredentialNames />
    <CouncilScheduleWidget />
    <OverviewActionsRemover />
    <SemesterLeaderboard />
    <StudentScorePrivacy />
  </StrictMode>
);
