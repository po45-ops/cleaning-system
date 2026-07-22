import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import CouncilCredentialBootstrap from "./CouncilCredentialBootstrap";
import CouncilCredentialNames from "./CouncilCredentialNames";
import CouncilScheduleWidget from "./CouncilScheduleWidget";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement!);

root.render(
  <StrictMode>
    <App />
    <CouncilCredentialBootstrap />
    <CouncilCredentialNames />
    <CouncilScheduleWidget />
  </StrictMode>
);
