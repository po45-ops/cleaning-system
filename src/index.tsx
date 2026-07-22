import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import CouncilCredentialBootstrap from "./CouncilCredentialBootstrap";
import CouncilCredentialNames from "./CouncilCredentialNames";
import CouncilScheduleWidget from "./CouncilScheduleWidget";
import StudentScorePrivacy from "./StudentScorePrivacy";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <App />
    <CouncilCredentialBootstrap />
    <CouncilCredentialNames />
    <CouncilScheduleWidget />
    <StudentScorePrivacy />
  </StrictMode>
);
