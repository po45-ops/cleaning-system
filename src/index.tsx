import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import CouncilCredentialNames from "./CouncilCredentialNames";
import CouncilScheduleWidget from "./CouncilScheduleWidget";
import StudentScorePrivacy from "./StudentScorePrivacy";
import "./styles.css";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <App />
    <CouncilCredentialNames />
    <CouncilScheduleWidget />
    <StudentScorePrivacy />
  </StrictMode>
);
