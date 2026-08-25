import React, { StrictMode, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import CouncilCredentialNames from "./CouncilCredentialNames";
import CouncilScheduleWidget from "./CouncilScheduleWidget";
import StudentScorePrivacy from "./StudentScorePrivacy";
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

  return <App />;
}

const rootElement = document.getElementById("root");
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <DefaultLoginEntry />
    <CouncilCredentialNames />
    <CouncilScheduleWidget />
    <StudentScorePrivacy />
  </StrictMode>
);
