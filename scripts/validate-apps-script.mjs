import { readFileSync } from "node:fs";
import vm from "node:vm";

const fileName = "apps-script/MessengerNotifications.gs";
const source = readFileSync(new URL(`../${fileName}`, import.meta.url), "utf8");

new vm.Script(source, { filename: fileName });

const approvedReportReads = source.match(
  /fetchCleaningRecords_\(config\)\.filter\(isApprovedRecord_\)/g
);
if ((approvedReportReads || []).length !== 3) {
  throw new Error(
    "Daily, weekly, and monthly PDFs must each filter to approved records."
  );
}

if (source.includes("ScriptApp.getOAuthToken()")) {
  throw new Error("Report image downloads must never attach an Apps Script OAuth token.");
}

const processJobStart = source.indexOf("function processCleaningReportJob_");
const dailyReportStart = source.indexOf("function createDailyCleaningReportPdf_");
const processJobSource = source.slice(processJobStart, dailyReportStart);
if (processJobStart < 0 || dailyReportStart < 0 || processJobSource.includes("report.url")) {
  throw new Error("Messenger report replies must not expose private Drive URLs.");
}

if (!source.includes('host === "googleusercontent.com"')) {
  throw new Error("Report images must use the explicit googleusercontent.com allowlist.");
}

console.log("Apps Script validation passed.");
