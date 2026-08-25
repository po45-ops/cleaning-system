/**
 * Facebook Messenger notifications for cleaning-system.
 *
 * Copy this file into the Google Apps Script project that serves the cleaning
 * data API. Keep every token and recipient ID in Script Properties; never put
 * them in App.tsx or any other public GitHub file.
 *
 * Meta policy note: this module uses standard Page-to-person messaging. The
 * recipient must have started a conversation with the Page and must still be
 * inside the messaging window allowed by Meta.
 */

const CLEANING_MESSENGER = Object.freeze({
  DEFAULT_DATA_URL:
    "https://script.google.com/macros/s/AKfycbyTSx3ggaJfXtYd_rQ67FoI5pPb8y_LXcTAm6RiSnkf34uiZL5GZBStGVMXyGCHQ5JfEA/exec",
  DEFAULT_APP_URL: "https://po45-ops.github.io/cleaning-system/",
  DEFAULT_TIME_ZONE: "Asia/Bangkok",
  DEFAULT_END_OF_DAY_TIME: "16:30",
  DEFAULT_GRAPH_VERSION: "v26.0",
  STATE_PROPERTY: "CLEANING_MESSENGER_STATE_V1",
  PENDING_RECIPIENTS_PROPERTY: "MESSENGER_PENDING_RECIPIENT_IDS",
  COUNCIL_SCHEDULE_PROPERTY_PREFIX: "COUNCIL_DUTY_SCHEDULE_V1_",
  REPORT_QUEUE_PROPERTY: "CLEANING_REPORT_JOB_QUEUE_V1",
  REPORT_TRIGGER_HANDLER: "processCleaningReportJobs",
  MAX_REPORT_QUEUE_ITEMS: 12,
  MAX_REPORT_IMAGE_BYTES: 5 * 1024 * 1024,
  MAX_REPORT_IMAGE_DATA_CHARS: 7 * 1024 * 1024,
  STATE_RETENTION_DAYS: 45,
  TOTAL_ZONES: 9,
  ZONES: [
    { id: 1, name: "เขต 1", className: "ป.1" },
    { id: 2, name: "เขต 2", className: "ป.2" },
    { id: 3, name: "เขต 3", className: "ป.3" },
    { id: 4, name: "เขต 4", className: "ป.4" },
    { id: 5, name: "เขต 5", className: "ป.5" },
    { id: 6, name: "เขต 6", className: "ป.6" },
    { id: 7, name: "เขต 7", className: "ม.1" },
    { id: 8, name: "เขต 8", className: "ม.2" },
    { id: 9, name: "เขต 9", className: "ม.3" },
  ],
  REMINDERS: [
    { type: "reminder_09", time: "09:00" },
    { type: "reminder_12", time: "12:00" },
    { type: "reminder_15", time: "15:00" },
  ],
});

/**
 * Creates safe defaults without writing a Page token or a recipient ID.
 * Run once from the Apps Script editor before adding Script Properties.
 */
function initializeCleaningMessengerConfig() {
  const properties = PropertiesService.getScriptProperties();
  const defaults = {
    CLEANING_DATA_URL: CLEANING_MESSENGER.DEFAULT_DATA_URL,
    CLEANING_APP_URL: CLEANING_MESSENGER.DEFAULT_APP_URL,
    CLEANING_TIME_ZONE: CLEANING_MESSENGER.DEFAULT_TIME_ZONE,
    END_OF_DAY_TIME: CLEANING_MESSENGER.DEFAULT_END_OF_DAY_TIME,
    META_GRAPH_API_VERSION: CLEANING_MESSENGER.DEFAULT_GRAPH_VERSION,
    MESSENGER_ENABLED: "false",
    MESSENGER_MESSAGING_TYPE: "UPDATE",
    MESSENGER_COMMANDS_ENABLED: "true",
    MESSENGER_COMMANDS_ADMIN_ONLY: "true",
    SEND_DAILY_PDF_REPORT: "true",
    SEND_MONTHLY_PDF_REPORT: "true",
    CLEANING_REPORT_MAX_IMAGES: "6",
    CLEANING_DAILY_REPORT_MAX_IMAGES: "27",
    CLEANING_WEEKLY_REPORT_MAX_IMAGES: "45",
    SCHOOL_NAME: "โรงเรียนไตรธารวิทยา",
  };

  Object.keys(defaults).forEach((key) => {
    if (properties.getProperty(key) === null) {
      properties.setProperty(key, defaults[key]);
    }
  });

  if (!properties.getProperty("META_WEBHOOK_VERIFY_TOKEN")) {
    properties.setProperty(
      "META_WEBHOOK_VERIFY_TOKEN",
      Utilities.getUuid().replace(/-/g, "")
    );
  }

  console.log(
    "สร้างค่าตั้งต้นแล้ว: ระบบยังไม่ส่งจริงจนกว่า MESSENGER_ENABLED จะเป็น true"
  );
}

/**
 * Installs one five-minute trigger. Re-running this function replaces only the
 * trigger owned by this module, so duplicate polling jobs are not created.
 */
function installCleaningMessengerTrigger() {
  initializeCleaningMessengerConfig();
  removeCleaningMessengerTriggers_();
  ScriptApp.newTrigger("checkCleaningNotifications")
    .timeBased()
    .everyMinutes(5)
    .create();
  console.log("ติดตั้งตัวตรวจแจ้งเตือนทุก 5 นาทีแล้ว");
}

function uninstallCleaningMessengerTrigger() {
  const removed = removeCleaningMessengerTriggers_();
  console.log(`ลบตัวตรวจแจ้งเตือนแล้ว ${removed} รายการ`);
}

function removeCleaningMessengerTriggers_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "checkCleaningNotifications") {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}

/**
 * Entry point for the five-minute trigger.
 */
function checkCleaningNotifications() {
  return runCleaningNotificationCycle_({ eventOnly: false, dryRun: false });
}

/**
 * Optional immediate hook. Call this after the existing doPost code has saved
 * or updated an inspection. It checks only completion/failure events; scheduled
 * reminders remain the responsibility of the five-minute trigger.
 */
function notifyCleaningDataChanged() {
  return runCleaningNotificationCycle_({ eventOnly: true, dryRun: false });
}

/**
 * Reads current data and prints message previews in Executions > Logs.
 * No message is sent and notification state is not changed.
 */
function previewCleaningMessengerMessages() {
  const config = getCleaningMessengerConfig_();
  const now = new Date();
  const snapshot = getCleaningSnapshot_(config, now);
  const previews = [
    buildReminderMessage_("reminder_09", snapshot, config),
    buildReminderMessage_("reminder_12", snapshot, config),
    buildReminderMessage_("reminder_15", snapshot, config),
    buildCompleteMessage_(snapshot, config),
    buildEndOfDayMessage_(snapshot, config),
  ];

  previews.forEach((message, index) => {
    console.log(`ตัวอย่าง ${index + 1}\n${message}`);
  });

  if (snapshot.failedRecords.length) {
    console.log(
      `ตัวอย่างแจ้งไม่ผ่าน\n${buildFailureMessage_(
        snapshot.failedRecords[0],
        snapshot,
        config
      )}`
    );
  } else {
    console.log("วันนี้ยังไม่มีรายการคะแนน 0 จึงไม่มีตัวอย่างแจ้งเขตไม่ผ่าน");
  }
}

/**
 * Sends one live connection-test message. Run only after the user has sent a
 * message to the Page and the Page ID, token, and recipient ID are configured.
 */
function sendCleaningMessengerConnectionTest() {
  const config = getCleaningMessengerConfig_();
  validateLiveMessengerConfig_(config);
  const dateKey = dateKeyInTimeZone_(new Date(), config.timeZone);
  const message = [
    "✅ เชื่อมต่อ Messenger สำเร็จ",
    "",
    thaiDateLabel_(dateKey),
    `${config.schoolName}`,
    "ระบบพร้อมรับคำสั่งแจ้งเตือนการตรวจความสะอาด",
    "",
    `🔗 ${config.appUrl}`,
  ].join("\n");

  sendMessengerText_(message, config.recipientIds, config);
  console.log(`ส่งข้อความทดสอบสำเร็จ ${config.recipientIds.length} ผู้รับ`);
}

/**
 * Clears only deduplication history. It does not delete any token or recipient.
 */
function resetCleaningMessengerNotificationState() {
  PropertiesService.getScriptProperties().deleteProperty(
    CLEANING_MESSENGER.STATE_PROPERTY
  );
  console.log("ล้างประวัติการส่งแล้ว การตรวจรอบถัดไปอาจส่งข้อความของวันนี้ใหม่");
}

function runCleaningNotificationCycle_(options) {
  const config = getCleaningMessengerConfig_();
  const dryRun = Boolean(options && options.dryRun);

  if (!config.enabled && !dryRun) {
    console.log("ข้ามการตรวจ: MESSENGER_ENABLED ยังไม่เป็น true");
    return { status: "disabled", sent: 0 };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.log("ข้ามการตรวจ: มีรอบแจ้งเตือนอื่นกำลังทำงานอยู่");
    return { status: "locked", sent: 0 };
  }

  try {
    if (!dryRun) validateLiveMessengerConfig_(config);

    const now = new Date();
    const snapshot = getCleaningSnapshot_(config, now);
    const events = buildDueEvents_(snapshot, config, now, {
      eventOnly: Boolean(options && options.eventOnly),
    });
    const state = loadNotificationState_();
    pruneNotificationState_(state, now);

    let sent = 0;
    events.forEach((event) => {
      if (!dryRun && state.sent[event.key]) return;

      if (dryRun) {
        console.log(`[DRY RUN] ${event.key}\n${event.message}`);
        return;
      }

      const recipients =
        event.audience === "admin"
          ? config.adminRecipientIds
          : config.recipientIds;
      sendMessengerText_(event.message, recipients, config);
      state.sent[event.key] = now.toISOString();
      saveNotificationState_(state);
      sent += 1;
    });

    const queuedReports = dryRun
      ? 0
      : queueAutomaticCleaningReports_(state, config, now);
    saveNotificationState_(state);
    console.log(
      `ตรวจสำเร็จ ${snapshot.checkedCount}/${CLEANING_MESSENGER.TOTAL_ZONES} เขต; ` +
        `ส่ง ${sent} เหตุการณ์; เข้าคิว PDF ${queuedReports} รายการ`
    );
    return {
      status: "ok",
      sent,
      queuedReports,
      checkedCount: snapshot.checkedCount,
    };
  } finally {
    lock.releaseLock();
  }
}

function getCleaningMessengerConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const messagingType = String(
    properties.getProperty("MESSENGER_MESSAGING_TYPE") || "UPDATE"
  ).toUpperCase();
  const recipientIds = parseRecipientIds_(
    properties.getProperty("MESSENGER_RECIPIENT_IDS") || ""
  );
  const adminIds = parseRecipientIds_(
    properties.getProperty("MESSENGER_ADMIN_RECIPIENT_IDS") || ""
  );

  return {
    enabled: /^true$/i.test(
      properties.getProperty("MESSENGER_ENABLED") || "false"
    ),
    commandsEnabled: !/^false$/i.test(
      properties.getProperty("MESSENGER_COMMANDS_ENABLED") || "true"
    ),
    commandsAdminOnly: !/^false$/i.test(
      properties.getProperty("MESSENGER_COMMANDS_ADMIN_ONLY") || "true"
    ),
    autoDailyPdf: !/^false$/i.test(
      properties.getProperty("SEND_DAILY_PDF_REPORT") || "true"
    ),
    autoMonthlyPdf: !/^false$/i.test(
      properties.getProperty("SEND_MONTHLY_PDF_REPORT") || "true"
    ),
    reportMaxImages: Math.max(
      1,
      Math.min(
        10,
        Number(properties.getProperty("CLEANING_REPORT_MAX_IMAGES") || "6") || 6
      )
    ),
    dailyReportMaxImages: Math.max(
      3,
      Math.min(
        27,
        Number(
          properties.getProperty("CLEANING_DAILY_REPORT_MAX_IMAGES") || "27"
        ) || 27
      )
    ),
    weeklyReportMaxImages: Math.max(
      3,
      Math.min(
        45,
        Number(
          properties.getProperty("CLEANING_WEEKLY_REPORT_MAX_IMAGES") || "45"
        ) || 45
      )
    ),
    dataUrl:
      properties.getProperty("CLEANING_DATA_URL") ||
      CLEANING_MESSENGER.DEFAULT_DATA_URL,
    appUrl:
      properties.getProperty("CLEANING_APP_URL") ||
      CLEANING_MESSENGER.DEFAULT_APP_URL,
    timeZone:
      properties.getProperty("CLEANING_TIME_ZONE") ||
      CLEANING_MESSENGER.DEFAULT_TIME_ZONE,
    endOfDayTime:
      properties.getProperty("END_OF_DAY_TIME") ||
      CLEANING_MESSENGER.DEFAULT_END_OF_DAY_TIME,
    schoolName:
      properties.getProperty("SCHOOL_NAME") || "โรงเรียนไตรธารวิทยา",
    graphVersion:
      properties.getProperty("META_GRAPH_API_VERSION") ||
      CLEANING_MESSENGER.DEFAULT_GRAPH_VERSION,
    pageId: properties.getProperty("META_PAGE_ID") || "",
    pageAccessToken:
      properties.getProperty("META_PAGE_ACCESS_TOKEN") || "",
    webhookVerifyToken:
      properties.getProperty("META_WEBHOOK_VERIFY_TOKEN") || "",
    messagingType:
      messagingType === "RESPONSE" ? "RESPONSE" : "UPDATE",
    recipientIds,
    adminRecipientIds: adminIds.length ? adminIds : recipientIds,
  };
}

function validateLiveMessengerConfig_(config) {
  const missing = [];
  if (!config.pageId) missing.push("META_PAGE_ID");
  if (!config.pageAccessToken) missing.push("META_PAGE_ACCESS_TOKEN");
  if (!config.recipientIds.length) missing.push("MESSENGER_RECIPIENT_IDS");
  if (!/^\d{2}:\d{2}$/.test(config.endOfDayTime)) {
    missing.push("END_OF_DAY_TIME (รูปแบบ HH:mm)");
  }

  if (missing.length) {
    throw new Error(`ตั้งค่า Script Properties ไม่ครบ: ${missing.join(", ")}`);
  }
}

function parseRecipientIds_(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[\s,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function fetchCleaningRecords_(config) {
  const separator = config.dataUrl.indexOf("?") >= 0 ? "&" : "?";
  const response = UrlFetchApp.fetch(
    `${config.dataUrl}${separator}refresh=${Date.now()}`,
    {
      method: "get",
      followRedirects: true,
      muteHttpExceptions: true,
    }
  );
  const statusCode = response.getResponseCode();
  const body = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`โหลดข้อมูลการตรวจไม่สำเร็จ: HTTP ${statusCode}`);
  }

  let json;
  try {
    json = JSON.parse(body);
  } catch (error) {
    throw new Error("โหลดข้อมูลการตรวจไม่สำเร็จ: คำตอบไม่ใช่ JSON");
  }

  if (json.status !== "success" || !Array.isArray(json.data)) {
    throw new Error(
      `โหลดข้อมูลการตรวจไม่สำเร็จ: ${json.message || "รูปแบบข้อมูลไม่ถูกต้อง"}`
    );
  }
  return json.data;
}

function getCleaningSnapshot_(config, now) {
  const records = fetchCleaningRecords_(config);
  const todayKey = dateKeyInTimeZone_(now, config.timeZone);
  const latestByZone = {};

  records.forEach((record, index) => {
    const zoneId = Number(record.zoneId);
    if (
      !Number.isInteger(zoneId) ||
      zoneId < 1 ||
      zoneId > CLEANING_MESSENGER.TOTAL_ZONES ||
      normalizeRecordDate_(record.date, config.timeZone) !== todayKey
    ) {
      return;
    }

    const candidate = Object.assign({}, record, { _sourceIndex: index });
    const current = latestByZone[zoneId];
    if (!current || compareRecordOrder_(candidate, current) >= 0) {
      latestByZone[zoneId] = candidate;
    }
  });

  const checkedZoneIds = Object.keys(latestByZone)
    .map(Number)
    .sort((a, b) => a - b);
  const missingZones = CLEANING_MESSENGER.ZONES.filter(
    (zone) => !latestByZone[zone.id]
  );
  const dutyByZone = getCouncilDutyByZone_(todayKey);
  const failedRecords = checkedZoneIds
    .map((zoneId) => latestByZone[zoneId])
    .filter(isFailedRecord_);

  return {
    dateKey: todayKey,
    recordsByZone: latestByZone,
    checkedZoneIds,
    checkedCount: checkedZoneIds.length,
    missingZones,
    dutyByZone,
    failedRecords,
  };
}

function compareRecordOrder_(left, right) {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return leftId - rightId;
  }

  const leftUpdated = Date.parse(
    left.updatedAt || left.timestamp || left.createdAt || ""
  );
  const rightUpdated = Date.parse(
    right.updatedAt || right.timestamp || right.createdAt || ""
  );
  if (Number.isFinite(leftUpdated) && Number.isFinite(rightUpdated)) {
    return leftUpdated - rightUpdated;
  }
  return Number(left._sourceIndex || 0) - Number(right._sourceIndex || 0);
}

function isFailedRecord_(record) {
  if (record.score === null || record.score === undefined || record.score === "") {
    return false;
  }
  return Number(record.score) === 0;
}

function isApprovedRecord_(record) {
  return String((record && record.status) || "").toLowerCase() === "approved";
}

function normalizeRecordDate_(value, timeZone) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return dateKeyInTimeZone_(date, timeZone);
}

function dateKeyInTimeZone_(date, timeZone) {
  return Utilities.formatDate(date, timeZone, "yyyy-MM-dd");
}

function buildDueEvents_(snapshot, config, now, options) {
  const events = [];
  const dateKey = snapshot.dateKey;

  snapshot.failedRecords.forEach((record) => {
    const zoneId = Number(record.zoneId);
    const recordIdentity = String(record.id || record._sourceIndex || "latest");
    events.push({
      key: `${dateKey}|failed|${zoneId}|${recordIdentity}`,
      audience: "admin",
      message: buildFailureMessage_(record, snapshot, config),
    });
  });

  if (snapshot.checkedCount === CLEANING_MESSENGER.TOTAL_ZONES) {
    events.push({
      key: `${dateKey}|complete`,
      audience: "all",
      message: buildCompleteMessage_(snapshot, config),
    });
  }

  if (options && options.eventOnly) return events;
  if (isWeekendDateKey_(dateKey)) return [];

  const currentTime = Utilities.formatDate(now, config.timeZone, "HH:mm");
  const afterEndOfDay = compareClockTimes_(currentTime, config.endOfDayTime) >= 0;

  if (
    snapshot.checkedCount < CLEANING_MESSENGER.TOTAL_ZONES &&
    !afterEndOfDay
  ) {
    const latestReminder = CLEANING_MESSENGER.REMINDERS.filter(
      (reminder) => compareClockTimes_(currentTime, reminder.time) >= 0
    ).pop();

    if (latestReminder) {
      events.push({
        key: `${dateKey}|${latestReminder.type}`,
        audience: "all",
        message: buildReminderMessage_(latestReminder.type, snapshot, config),
      });
    }
  }

  if (afterEndOfDay) {
    events.push({
      key: `${dateKey}|end_of_day`,
      audience: "all",
      message: buildEndOfDayMessage_(snapshot, config),
    });
  }

  return events;
}

function compareClockTimes_(left, right) {
  const toMinutes = (value) => {
    const parts = String(value).split(":").map(Number);
    return parts[0] * 60 + parts[1];
  };
  return toMinutes(left) - toMinutes(right);
}

function isWeekendDateKey_(dateKey) {
  const parts = dateKey.split("-").map(Number);
  const day = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  return day === 0 || day === 6;
}

function buildReminderMessage_(type, snapshot, config) {
  const definitions = {
    reminder_09: {
      heading: "🔔 แจ้งเตือนการตรวจความสะอาด — ครั้งที่ 1",
      time: "09:00",
      includeZones: true,
    },
    reminder_12: {
      heading: "🔔 แจ้งเตือนการตรวจความสะอาด",
      time: "12:00",
      includeZones: true,
    },
    reminder_15: {
      heading: "⏰ แจ้งเตือนการตรวจความสะอาด — ครั้งสุดท้าย",
      time: "15:00",
      includeZones: true,
    },
  };
  const definition = definitions[type] || definitions.reminder_12;
  const lines = [
    definition.heading,
    "",
    thaiDateLabel_(snapshot.dateKey),
    `เวลา ${definition.time} น.`,
    "",
    `✅ ตรวจแล้ว ${snapshot.checkedCount}/${CLEANING_MESSENGER.TOTAL_ZONES} เขต`,
    `⚠️ ยังไม่ได้ตรวจ ${snapshot.missingZones.length} เขต`,
  ];

  if (definition.includeZones && snapshot.missingZones.length) {
    lines.push(
      "",
      ...formatZoneDutyLines_(snapshot.missingZones, snapshot.dutyByZone)
    );
  }

  lines.push(
    "",
    "กรุณาดำเนินการตรวจให้เรียบร้อย",
    "",
    `🔗 เปิดระบบตรวจความสะอาด`,
    config.appUrl
  );
  return lines.join("\n");
}

function buildCompleteMessage_(snapshot, config) {
  return [
    "✅ ตรวจความสะอาดเสร็จสมบูรณ์",
    "",
    thaiDateLabel_(snapshot.dateKey),
    "",
    `วันนี้ตรวจครบ ${CLEANING_MESSENGER.TOTAL_ZONES}/${CLEANING_MESSENGER.TOTAL_ZONES} เขต — 100% 🎉`,
    "ขอบคุณคณะกรรมการทุกท่าน",
    "",
    config.schoolName,
    `🔗 ${config.appUrl}`,
  ].join("\n");
}

function buildFailureMessage_(record, snapshot, config) {
  const zone = CLEANING_MESSENGER.ZONES.find(
    (item) => item.id === Number(record.zoneId)
  );
  const notes = String(record.notes || "ไม่มีหมายเหตุ").trim();
  const duty = snapshot.dutyByZone[Number(record.zoneId)];
  return [
    "⚠️ พบเขตที่ไม่ผ่านการตรวจความสะอาด",
    "",
    thaiDateLabel_(snapshot.dateKey),
    `${zone ? `${zone.name} · ${zone.className}` : `เขต ${record.zoneId}`}`,
    formatCouncilDutyLine_(duty),
    "คะแนน 0/3 — ไม่ผ่าน",
    `สถานะ: ${thaiInspectionStatus_(record.status)}`,
    `หมายเหตุ: ${notes}`,
    "",
    "กรุณาให้ผู้ดูแลตรวจสอบและดำเนินการแก้ไข",
    `🔗 ${config.appUrl}`,
  ].join("\n");
}
function buildEndOfDayMessage_(snapshot, config) {
  const percent = Math.round(
    (snapshot.checkedCount / CLEANING_MESSENGER.TOTAL_ZONES) * 100
  );
  const lines = [
    "📊 สรุปการตรวจความสะอาดประจำวัน",
    "",
    thaiDateLabel_(snapshot.dateKey),
    "",
    `ตรวจแล้ว ${snapshot.checkedCount}/${CLEANING_MESSENGER.TOTAL_ZONES} เขต — ${percent}%`,
    `ยังไม่ได้ตรวจ ${snapshot.missingZones.length} เขต`,
    `เขตไม่ผ่าน ${snapshot.failedRecords.length} เขต`,
  ];

  if (snapshot.missingZones.length) {
    lines.push(
      "",
      "เขตที่ยังไม่ได้ตรวจ",
      ...formatZoneDutyLines_(snapshot.missingZones, snapshot.dutyByZone)
    );
  }
  if (snapshot.failedRecords.length) {
    const failedZones = snapshot.failedRecords
      .map((record) =>
        CLEANING_MESSENGER.ZONES.find(
          (zone) => zone.id === Number(record.zoneId)
        )
      )
      .filter(Boolean);
    lines.push("", "เขตที่ไม่ผ่าน", ...formatZoneLines_(failedZones));
  }

  lines.push("", `🔗 ดูรายงานฉบับเต็ม`, config.appUrl);
  return lines.join("\n");
}

function formatZoneLines_(zones) {
  return zones.map((zone) => `• ${zone.name} · ${zone.className}`);
}

function formatZoneDutyLines_(zones, dutyByZone) {
  const lines = [];
  zones.forEach((zone) => {
    lines.push(`• ${zone.name} · ${zone.className}`);
    lines.push(`  ${formatCouncilDutyLine_(dutyByZone[zone.id])}`);
  });
  return lines;
}

function formatCouncilDutyLine_(duty) {
  if (!duty) {
    return "ผู้รับผิดชอบ: ยังไม่พบตารางเวรที่เผยแพร่";
  }
  const members = duty.members.length
    ? duty.members.join(" · ")
    : "ยังไม่มีรายชื่อสมาชิก";
  const account = duty.accountId ? ` (${duty.accountId})` : "";
  return `ผู้รับผิดชอบ: กลุ่มที่ ${duty.groupNumber}${account} — ${members}`;
}

function thaiDateLabel_(dateKey) {
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const weekdays = [
    "วันอาทิตย์",
    "วันจันทร์",
    "วันอังคาร",
    "วันพุธ",
    "วันพฤหัสบดี",
    "วันศุกร์",
    "วันเสาร์",
  ];
  const parts = dateKey.split("-").map(Number);
  const weekday = new Date(
    Date.UTC(parts[0], parts[1] - 1, parts[2])
  ).getUTCDay();
  return `${weekdays[weekday]}ที่ ${parts[2]} ${months[parts[1] - 1]} ${
    parts[0] + 543
  }`;
}

function thaiInspectionStatus_(status) {
  const labels = {
    approved: "อนุมัติแล้ว",
    pending: "รออนุมัติ",
    rejected: "ส่งกลับแก้ไข",
  };
  return labels[String(status || "").toLowerCase()] || "ไม่ระบุ";
}

function sendMessengerText_(message, recipientIds, config) {
  if (!recipientIds.length) {
    throw new Error("ไม่มี PSID ผู้รับสำหรับข้อความนี้");
  }

  recipientIds.forEach((recipientId) => {
    sendMessengerTextToOne_(message, recipientId, config);
  });
}

function sendMessengerTextToOne_(message, recipientId, config) {
  const endpoint = `https://graph.facebook.com/${encodeURIComponent(
    config.graphVersion
  )}/${encodeURIComponent(config.pageId)}/messages`;
  const payload = {
    recipient: { id: recipientId },
    messaging_type: config.messagingType,
    message: { text: message },
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${config.pageAccessToken}`,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const statusCode = response.getResponseCode();
    const body = response.getContentText();

    if (statusCode >= 200 && statusCode < 300) return;

    lastError = new Error(
      `Meta Messenger API ตอบ HTTP ${statusCode}: ${body.slice(0, 500)}`
    );
    const retryable = statusCode === 429 || statusCode >= 500;
    if (!retryable || attempt === 3) break;
    Utilities.sleep(1000 * Math.pow(2, attempt - 1));
  }
  throw lastError;
}

function loadNotificationState_() {
  const raw = PropertiesService.getScriptProperties().getProperty(
    CLEANING_MESSENGER.STATE_PROPERTY
  );
  if (!raw) return { sent: {} };
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.sent ? parsed : { sent: {} };
  } catch (error) {
    return { sent: {} };
  }
}

function saveNotificationState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    CLEANING_MESSENGER.STATE_PROPERTY,
    JSON.stringify(state)
  );
}

function pruneNotificationState_(state, now) {
  const cutoff =
    now.getTime() - CLEANING_MESSENGER.STATE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  Object.keys(state.sent).forEach((key) => {
    const timestamp = Date.parse(state.sent[key]);
    if (!Number.isFinite(timestamp) || timestamp < cutoff) {
      delete state.sent[key];
    }
  });
}

/**
 * Stores the published council duty schedule sent by the admin schedule UI.
 * One Script Property is used per month to stay below Apps Script value limits.
 */
function handleCouncilDutySchedulePost_(payload) {
  try {
    const schedule = normalizeCouncilDutySchedule_(payload.schedule);
    const serialized = JSON.stringify(schedule);
    if (serialized.length > 8500) {
      throw new Error("ตารางเวรมีขนาดใหญ่เกินกำหนด");
    }
    PropertiesService.getScriptProperties().setProperty(
      councilDutySchedulePropertyKey_(schedule.key),
      serialized
    );
    return createJsonTextOutput_({
      status: "success",
      message: schedule.published
        ? "ซิงก์ตารางเวรที่เผยแพร่แล้ว"
        : "ซิงก์ตารางเวรฉบับร่างแล้ว",
      scheduleKey: schedule.key,
      published: schedule.published,
    });
  } catch (error) {
    return createJsonTextOutput_({
      status: "error",
      message: String((error && error.message) || error || "ข้อมูลไม่ถูกต้อง"),
    });
  }
}

function handleCouncilDutyScheduleGet_(scheduleKey) {
  if (!/^\d{4}-\d{2}$/.test(String(scheduleKey || ""))) {
    return createJsonTextOutput_({
      status: "error",
      message: "กรุณาระบุเดือนรูปแบบ YYYY-MM",
    });
  }
  const raw = PropertiesService.getScriptProperties().getProperty(
    councilDutySchedulePropertyKey_(scheduleKey)
  );
  let schedule = null;
  if (raw) {
    try {
      schedule = JSON.parse(raw);
    } catch (error) {
      schedule = null;
    }
  }
  return createJsonTextOutput_({ status: "success", data: schedule });
}

function createJsonTextOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function normalizeCouncilDutySchedule_(input) {
  if (!input || typeof input !== "object") {
    throw new Error("ไม่พบข้อมูลตารางเวร");
  }
  const year = Number(input.year);
  const month = Number(input.month);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new Error("ปีของตารางเวรไม่ถูกต้อง");
  }
  if (!Number.isInteger(month) || month < 0 || month > 11) {
    throw new Error("เดือนของตารางเวรไม่ถูกต้อง");
  }
  const expectedKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (String(input.key || "") !== expectedKey) {
    throw new Error("รหัสเดือนของตารางเวรไม่ตรงกับปีและเดือน");
  }
  if (!Array.isArray(input.groups) || input.groups.length !== 9) {
    throw new Error("ตารางเวรต้องมี 9 กลุ่ม");
  }
  if (!Array.isArray(input.weeks) || !input.weeks.length || input.weeks.length > 6) {
    throw new Error("จำนวนสัปดาห์ในตารางเวรไม่ถูกต้อง");
  }

  const groupIds = {};
  const groups = input.groups.map((group) => {
    const id = String((group && group.id) || "").trim().slice(0, 80);
    if (!id || groupIds[id]) {
      throw new Error("รหัสกลุ่มซ้ำหรือไม่ถูกต้อง");
    }
    groupIds[id] = true;
    const members = Array.isArray(group.members)
      ? group.members
          .map((name) => String(name || "").trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    return {
      id,
      accountId: String(group.accountId || "").trim().slice(0, 80),
      homeClass: String(group.homeClass || "").trim().slice(0, 40),
      homeZoneId: Number(group.homeZoneId),
      members,
    };
  });

  const weekIds = {};
  const weeks = input.weeks.map((week) => {
    const id = String((week && week.id) || "").trim().slice(0, 100);
    const start = String((week && week.start) || "");
    const end = String((week && week.end) || "");
    if (!id || weekIds[id] || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new Error("ข้อมูลสัปดาห์ไม่ถูกต้อง");
    }
    weekIds[id] = true;
    return {
      id,
      label: String(week.label || "").trim().slice(0, 80),
      start,
      end,
    };
  });

  const assignments = {};
  weeks.forEach((week) => {
    const source = input.assignments && input.assignments[week.id];
    if (!source || typeof source !== "object") {
      throw new Error(`ไม่พบการจัดเขตของ ${week.label || week.id}`);
    }
    const zoneIds = {};
    assignments[week.id] = {};
    groups.forEach((group) => {
      const zoneId = Number(source[group.id]);
      if (!Number.isInteger(zoneId) || zoneId < 1 || zoneId > 9 || zoneIds[zoneId]) {
        throw new Error(`การจัดเขตของ ${week.label || week.id} ไม่ครบหรือมีเขตซ้ำ`);
      }
      zoneIds[zoneId] = true;
      assignments[week.id][group.id] = zoneId;
    });
  });

  return {
    key: expectedKey,
    year,
    month,
    weeks,
    assignments,
    groups,
    published: Boolean(input.published),
    updatedAt: String(input.updatedAt || new Date().toISOString()).slice(0, 80),
    shuffleNonce: Number(input.shuffleNonce) || 0,
  };
}

function councilDutySchedulePropertyKey_(scheduleKey) {
  return (
    CLEANING_MESSENGER.COUNCIL_SCHEDULE_PROPERTY_PREFIX +
    String(scheduleKey).replace(/-/g, "_")
  );
}

function getCouncilDutyByZone_(dateKey) {
  const resolved = findPublishedCouncilDutyWeekForDate_(dateKey);
  return resolved
    ? getCouncilDutyByZoneForWeek_(resolved.schedule, resolved.week)
    : {};
}
/** Logs the council group responsible for every zone today. */
function previewCouncilDutyForToday() {
  const config = getCleaningMessengerConfig_();
  const dateKey = dateKeyInTimeZone_(new Date(), config.timeZone);
  const dutyByZone = getCouncilDutyByZone_(dateKey);
  CLEANING_MESSENGER.ZONES.forEach((zone) => {
    console.log(`${zone.name}: ${formatCouncilDutyLine_(dutyByZone[zone.id])}`);
  });
}

/**
 * PDF report jobs are queued so the Meta webhook can answer quickly. The
 * one-time trigger creates the report, stores it in Drive, then sends the PDF
 * back to the approved Messenger recipient.
 */
function enqueueCleaningReportJob_(type, senderId, config, options) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  const properties = PropertiesService.getScriptProperties();
  try {
    const raw = properties.getProperty(
      CLEANING_MESSENGER.REPORT_QUEUE_PROPERTY
    );
    let queue = [];
    try {
      queue = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(queue)) queue = [];
    } catch (error) {
      queue = [];
    }

    const messageId = String((options && options.messageId) || "");
    if (messageId && queue.some((item) => item.messageId === messageId)) {
      return false;
    }

    const now = new Date();
    const dateKey =
      (options && options.dateKey) || dateKeyInTimeZone_(now, config.timeZone);
    const monthKey =
      (options && options.monthKey) || String(dateKey).slice(0, 7);
    const weekStartKey =
      (options && options.weekStartKey) || getSchoolWeekRange_(dateKey).startKey;
    queue.push({
      id: Utilities.getUuid(),
      type,
      senderId: String(senderId),
      dateKey,
      monthKey,
      weekStartKey,
      messageId,
      messagingType: String(
        (options && options.messagingType) || "RESPONSE"
      ).toUpperCase(),
      requestedAt: now.toISOString(),
    });
    queue = queue.slice(-CLEANING_MESSENGER.MAX_REPORT_QUEUE_ITEMS);
    properties.setProperty(
      CLEANING_MESSENGER.REPORT_QUEUE_PROPERTY,
      JSON.stringify(queue)
    );
  } finally {
    lock.releaseLock();
  }
  ensureCleaningReportJobTrigger_();
  return true;
}

function ensureCleaningReportJobTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(
    (trigger) =>
      trigger.getHandlerFunction() === CLEANING_MESSENGER.REPORT_TRIGGER_HANDLER
  );
  if (!exists) {
    ScriptApp.newTrigger(CLEANING_MESSENGER.REPORT_TRIGGER_HANDLER)
      .timeBased()
      .after(1000)
      .create();
  }
}

function removeCleaningReportJobTriggers_() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (
      trigger.getHandlerFunction() === CLEANING_MESSENGER.REPORT_TRIGGER_HANDLER
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function processCleaningReportJobs() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  let jobs = [];
  try {
    const properties = PropertiesService.getScriptProperties();
    const raw = properties.getProperty(
      CLEANING_MESSENGER.REPORT_QUEUE_PROPERTY
    );
    let queue = [];
    try {
      queue = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(queue)) queue = [];
    } catch (error) {
      queue = [];
    }

    jobs = queue.splice(0, 2);
    properties.setProperty(
      CLEANING_MESSENGER.REPORT_QUEUE_PROPERTY,
      JSON.stringify(queue)
    );
  } finally {
    lock.releaseLock();
  }

  const config = getCleaningMessengerConfig_();
  jobs.forEach((job) => {
    try {
      processCleaningReportJob_(job, config);
    } catch (error) {
      console.error(
        `สร้างรายงาน PDF ไม่สำเร็จ: ${(error && error.stack) || error}`
      );
      try {
        sendMessengerReply_(
          "⚠️ สร้างรายงาน PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
          job.senderId,
          config
        );
      } catch (sendError) {
        console.error(`ส่งข้อความแจ้งข้อผิดพลาดไม่สำเร็จ: ${sendError}`);
      }
    }
  });

  removeCleaningReportJobTriggers_();
  const remainingRaw = PropertiesService.getScriptProperties().getProperty(
    CLEANING_MESSENGER.REPORT_QUEUE_PROPERTY
  );
  try {
    const remainingQueue = remainingRaw ? JSON.parse(remainingRaw) : [];
    if (Array.isArray(remainingQueue) && remainingQueue.length) {
      ensureCleaningReportJobTrigger_();
    }
  } catch (error) {
    console.error(`อ่านคิวรายงานที่เหลือไม่สำเร็จ: ${error}`);
  }
}

function processCleaningReportJob_(job, config) {
  let report;
  if (job.type === "monthly_pdf") {
    report = createMonthlyCleaningReportPdf_(config, job.monthKey);
  } else if (job.type === "weekly_pdf") {
    report = createWeeklyCleaningReportPdf_(
      config,
      job.weekStartKey || job.dateKey
    );
  } else {
    report = createDailyCleaningReportPdf_(config, job.dateKey);
  }
  const reportConfig = Object.assign({}, config, {
    messagingType:
      job.messagingType === "UPDATE" ? "UPDATE" : "RESPONSE",
  });

  sendMessengerPdfAttachmentToOne_(report.blob, job.senderId, reportConfig);

  const lines = [
    "✅ จัดทำและส่งไฟล์ PDF แล้ว",
    report.title,
    "",
    report.summary,
  ];
  sendMessengerTextToOne_(lines.join("\n"), job.senderId, reportConfig);
}

function createDailyCleaningReportPdf_(config, dateKey) {
  const records = fetchCleaningRecords_(config).filter(isApprovedRecord_);
  const snapshot = buildCleaningSnapshotForDate_(records, dateKey, config);
  const reportFolder = getCleaningReportFolder_();
  const timestamp = Utilities.formatDate(
    new Date(),
    config.timeZone,
    "HHmmss"
  );
  const fileName = `cleaning-daily-${dateKey}-${timestamp}.pdf`;
  const doc = DocumentApp.create(`temp-${fileName}`);
  const sourceFile = DriveApp.getFileById(doc.getId());

  try {
    const body = doc.getBody();
    appendReportTitle_(
      body,
      "รายงานการตรวจความสะอาดประจำวัน",
      `${config.schoolName}\n${thaiDateLabel_(dateKey)}`
    );
    const percent = Math.round(
      (snapshot.checkedCount / CLEANING_MESSENGER.TOTAL_ZONES) * 100
    );
    body.appendParagraph(
      `สรุปผล: ตรวจแล้ว ${snapshot.checkedCount}/9 เขต (${percent}%) | ` +
        `ยังไม่รายงาน ${snapshot.missingZones.length} เขต | ` +
        `ไม่ผ่าน ${snapshot.failedRecords.length} เขต`
    );

    const rows = [
      ["เขต", "ผู้รับผิดชอบ", "คะแนน", "สถานะ", "หมายเหตุ"],
    ];
    CLEANING_MESSENGER.ZONES.forEach((zone) => {
      const record = snapshot.recordsByZone[zone.id];
      const duty = snapshot.dutyByZone[zone.id];
      rows.push([
        `${zone.name} ${zone.className}`,
        formatCouncilDutyLine_(duty).replace("ผู้รับผิดชอบ: ", ""),
        record && record.score !== "" && record.score !== undefined
          ? `${record.score}/3`
          : "ยังไม่รายงาน",
        record ? thaiInspectionStatus_(record.status) : "—",
        record ? String(record.notes || "—") : "—",
      ]);
    });
    const table = body.appendTable(rows);
    styleReportTable_(table, {
      columnWidths: [62, 165, 54, 68, 105],
    });

    appendReportSignatureBlock_(body);
    body.appendPageBreak();
    body.appendParagraph("ภาคผนวก: ภาพประกอบการตรวจประจำวัน").setHeading(
      DocumentApp.ParagraphHeading.HEADING1
    );
    const imageRecords = CLEANING_MESSENGER.ZONES.map(
      (zone) => snapshot.recordsByZone[zone.id]
    ).filter(Boolean);
    appendReportImages_(
      body,
      imageRecords,
      config.dailyReportMaxImages,
      config
    );
    appendReportFooter_(body, config);
    doc.saveAndClose();

    const blob = sourceFile.getAs(MimeType.PDF).setName(fileName);
    const pdfFile = reportFolder.createFile(blob);
    return {
      title: `รายงานประจำวัน ${thaiDateLabel_(dateKey)}`,
      summary: `ตรวจแล้ว ${snapshot.checkedCount}/9 เขต — ${percent}%`,
      url: pdfFile.getUrl(),
      blob: pdfFile.getBlob().setName(fileName),
      fileId: pdfFile.getId(),
    };
  } finally {
    try {
      sourceFile.setTrashed(true);
    } catch (error) {
      console.error(`ลบเอกสารชั่วคราวไม่สำเร็จ: ${error}`);
    }
  }
}

function createWeeklyCleaningReportPdf_(config, dateKey) {
  const records = fetchCleaningRecords_(config).filter(isApprovedRecord_);
  const summary = buildWeeklyCleaningSummary_(records, dateKey, config);
  const reportFolder = getCleaningReportFolder_();
  const timestamp = Utilities.formatDate(
    new Date(),
    config.timeZone,
    "HHmmss"
  );
  const fileName =
    `cleaning-weekly-${summary.startKey}-${summary.endKey}-${timestamp}.pdf`;
  const doc = DocumentApp.create(`temp-${fileName}`);
  const sourceFile = DriveApp.getFileById(doc.getId());

  try {
    const body = doc.getBody();
    appendReportTitle_(
      body,
      "ตารางบันทึกการปฏิบัติงาน\nทำความสะอาดเขตพื้นที่รับผิดชอบ",
      `${config.schoolName}\nประจำสัปดาห์ (${formatThaiDateRange_(
        summary.startKey,
        summary.endKey
      )})`
    );
    body
      .appendParagraph(
        `สรุปผล: บันทึกแล้ว ${summary.checkedSlots}/${summary.totalSlots} รายการ | ` +
          `คะแนนรวม ${summary.totalScore} คะแนน | ` +
          `ไม่ผ่าน ${summary.failedRecords.length} รายการ`
      )
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const scoreRows = [
      ["รายการ / เขตพื้นที่", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "รวม"],
    ];
    CLEANING_MESSENGER.ZONES.forEach((zone) => {
      let hasScore = false;
      let total = 0;
      const dayScores = summary.dateKeys.map((currentDateKey) => {
        const record =
          summary.recordsByDateZone[`${currentDateKey}|${zone.id}`];
        const numericScore = record ? Number(record.score) : NaN;
        if (!Number.isFinite(numericScore)) return "-";
        hasScore = true;
        total += numericScore;
        return String(numericScore);
      });
      scoreRows.push([
        `${zone.name} ${zone.className}`,
        ...dayScores,
        hasScore ? String(total) : "-",
      ]);
    });
    styleReportTable_(body.appendTable(scoreRows), {
      columnWidths: [190, 42, 42, 42, 42, 42, 54],
    });

    appendReportSignatureBlock_(body);
    body.appendPageBreak();
    body
      .appendParagraph("สรุปเวรผู้รับผิดชอบประจำสัปดาห์")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    body
      .appendParagraph(formatThaiDateRange_(summary.startKey, summary.endKey))
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    const dutyRows = [["เขต", "ชั้น", "ผู้รับผิดชอบ"]];
    CLEANING_MESSENGER.ZONES.forEach((zone) => {
      dutyRows.push([
        zone.name,
        zone.className,
        formatCouncilDutyLine_(summary.dutyByZone[zone.id]).replace(
          "ผู้รับผิดชอบ: ",
          ""
        ),
      ]);
    });
    styleReportTable_(body.appendTable(dutyRows), {
      columnWidths: [70, 70, 310],
    });

    body.appendPageBreak();
    body
      .appendParagraph("ภาคผนวก: ภาพถ่ายหลักฐานประกอบการตรวจประจำสัปดาห์")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body
      .appendParagraph(formatThaiDateRange_(summary.startKey, summary.endKey))
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    appendReportImages_(
      body,
      summary.records,
      config.weeklyReportMaxImages,
      config
    );
    appendReportFooter_(body, config);
    doc.saveAndClose();

    const blob = sourceFile.getAs(MimeType.PDF).setName(fileName);
    const pdfFile = reportFolder.createFile(blob);
    return {
      title: `รายงานประจำสัปดาห์ ${formatThaiDateRange_(
        summary.startKey,
        summary.endKey
      )}`,
      summary:
        `บันทึกแล้ว ${summary.checkedSlots}/${summary.totalSlots} รายการ — ` +
        `มีภาพหลักฐาน ${summary.recordsWithImages.length} รายการ`,
      url: pdfFile.getUrl(),
      blob: pdfFile.getBlob().setName(fileName),
      fileId: pdfFile.getId(),
    };
  } finally {
    try {
      sourceFile.setTrashed(true);
    } catch (error) {
      console.error(`ลบเอกสารชั่วคราวไม่สำเร็จ: ${error}`);
    }
  }
}

function createMonthlyCleaningReportPdf_(config, monthKey) {
  const records = fetchCleaningRecords_(config).filter(isApprovedRecord_);
  const summary = buildMonthlyCleaningSummary_(records, monthKey, config);
  const reportFolder = getCleaningReportFolder_();
  const timestamp = Utilities.formatDate(
    new Date(),
    config.timeZone,
    "HHmmss"
  );
  const fileName = `cleaning-monthly-${monthKey}-${timestamp}.pdf`;
  const doc = DocumentApp.create(`temp-${fileName}`);
  const sourceFile = DriveApp.getFileById(doc.getId());

  try {
    const body = doc.getBody();
    appendReportTitle_(
      body,
      "รายงานการตรวจความสะอาดประจำเดือน",
      `${config.schoolName}\n${thaiMonthYearLabel_(monthKey)}`
    );
    body.appendParagraph(
      `ความครอบคลุม ${summary.coveragePercent}% | ` +
        `วันที่ตรวจครบ ${summary.completeDays} วัน | ` +
        `ตรวจบางส่วน ${summary.partialDays} วัน | ` +
        `ไม่มีข้อมูล ${summary.noDataDays} วัน | ` +
        `รายการไม่ผ่าน ${summary.failedRecords.length} รายการ`
    );

    body.appendParagraph("สรุปรายวัน").setHeading(
      DocumentApp.ParagraphHeading.HEADING1
    );
    const dayRows = [["วันที่", "ตรวจแล้ว", "ไม่ผ่าน", "ความครอบคลุม"]];
    summary.days.forEach((day) => {
      dayRows.push([
        day.dateKey,
        `${day.checkedCount}/9`,
        String(day.failedCount),
        `${Math.round((day.checkedCount / 9) * 100)}%`,
      ]);
    });
    styleReportTableHeader_(body.appendTable(dayRows));

    body.appendParagraph("ผลรายเขต").setHeading(
      DocumentApp.ParagraphHeading.HEADING1
    );
    const zoneRows = [["เขต", "รายงาน", "ไม่ผ่าน", "คะแนนเฉลี่ย"]];
    summary.zoneStats.forEach((item) => {
      zoneRows.push([
        `${item.zone.name} ${item.zone.className}`,
        `${item.reportedDays}/${summary.workdayCount} วัน`,
        `${item.failedCount} ครั้ง`,
        item.averageScore === null ? "—" : item.averageScore.toFixed(2),
      ]);
    });
    styleReportTableHeader_(body.appendTable(zoneRows));

    body.appendParagraph("เหตุการณ์และหมายเหตุสำคัญ").setHeading(
      DocumentApp.ParagraphHeading.HEADING1
    );
    if (!summary.notableRecords.length) {
      body.appendParagraph("ไม่พบรายการไม่ผ่านหรือหมายเหตุเพิ่มเติม");
    } else {
      summary.notableRecords.slice(0, 30).forEach((record) => {
        const zone = CLEANING_MESSENGER.ZONES.find(
          (item) => item.id === Number(record.zoneId)
        );
        body.appendListItem(
          `${normalizeRecordDate_(record.date, config.timeZone)} — ` +
            `${zone ? `${zone.name} ${zone.className}` : `เขต ${record.zoneId}`} — ` +
            `คะแนน ${record.score}/3 — ${String(record.notes || "ไม่มีหมายเหตุ")}`
        );
      });
    }

    body.appendParagraph("ภาพประกอบที่คัดเลือก").setHeading(
      DocumentApp.ParagraphHeading.HEADING1
    );
    appendReportImages_(
      body,
      summary.representativeRecords,
      Math.min(config.reportMaxImages + 2, 10),
      config
    );
    appendReportFooter_(body, config);
    doc.saveAndClose();

    const blob = sourceFile.getAs(MimeType.PDF).setName(fileName);
    const pdfFile = reportFolder.createFile(blob);
    return {
      title: `รายงานประจำเดือน ${thaiMonthYearLabel_(monthKey)}`,
      summary: `ความครอบคลุม ${summary.coveragePercent}% — ตรวจครบ ${summary.completeDays} วัน`,
      url: pdfFile.getUrl(),
      blob: pdfFile.getBlob().setName(fileName),
      fileId: pdfFile.getId(),
    };
  } finally {
    try {
      sourceFile.setTrashed(true);
    } catch (error) {
      console.error(`ลบเอกสารชั่วคราวไม่สำเร็จ: ${error}`);
    }
  }
}

function buildCleaningSnapshotForDate_(records, dateKey, config) {
  const latestByZone = {};
  records.forEach((record, index) => {
    const zoneId = Number(record.zoneId);
    if (
      !Number.isInteger(zoneId) ||
      zoneId < 1 ||
      zoneId > 9 ||
      normalizeRecordDate_(record.date, config.timeZone) !== dateKey
    ) {
      return;
    }
    const candidate = Object.assign({}, record, { _sourceIndex: index });
    const current = latestByZone[zoneId];
    if (!current || compareRecordOrder_(candidate, current) >= 0) {
      latestByZone[zoneId] = candidate;
    }
  });
  const checkedZoneIds = Object.keys(latestByZone).map(Number).sort((a, b) => a - b);
  return {
    dateKey,
    recordsByZone: latestByZone,
    checkedZoneIds,
    checkedCount: checkedZoneIds.length,
    missingZones: CLEANING_MESSENGER.ZONES.filter(
      (zone) => !latestByZone[zone.id]
    ),
    dutyByZone: getCouncilDutyByZone_(dateKey),
    failedRecords: checkedZoneIds
      .map((zoneId) => latestByZone[zoneId])
      .filter(isFailedRecord_),
  };
}

function buildWeeklyCleaningSummary_(records, dateKey, config) {
  const range = getSchoolWeekRange_(dateKey);
  const dateLookup = {};
  range.dateKeys.forEach((item) => {
    dateLookup[item] = true;
  });
  const latestByDateZone = {};

  records.forEach((record, index) => {
    const normalizedDate = normalizeRecordDate_(record.date, config.timeZone);
    const zoneId = Number(record.zoneId);
    if (
      !dateLookup[normalizedDate] ||
      !Number.isInteger(zoneId) ||
      zoneId < 1 ||
      zoneId > CLEANING_MESSENGER.TOTAL_ZONES
    ) {
      return;
    }
    const key = `${normalizedDate}|${zoneId}`;
    const candidate = Object.assign({}, record, {
      _sourceIndex: index,
      _dateKey: normalizedDate,
    });
    if (
      !latestByDateZone[key] ||
      compareRecordOrder_(candidate, latestByDateZone[key]) >= 0
    ) {
      latestByDateZone[key] = candidate;
    }
  });

  const values = Object.keys(latestByDateZone)
    .map((key) => latestByDateZone[key])
    .sort((left, right) => {
      const dateCompare = String(left._dateKey).localeCompare(
        String(right._dateKey)
      );
      return dateCompare || Number(left.zoneId) - Number(right.zoneId);
    });
  const numericScores = values
    .map((record) => Number(record.score))
    .filter(Number.isFinite);
  const recordsWithImages = values.filter(
    (record) => Array.isArray(record.images) && record.images.length
  );

  return {
    startKey: range.startKey,
    endKey: range.endKey,
    dateKeys: range.dateKeys,
    recordsByDateZone: latestByDateZone,
    records: values,
    recordsWithImages,
    checkedSlots: values.length,
    totalSlots: range.dateKeys.length * CLEANING_MESSENGER.TOTAL_ZONES,
    totalScore: numericScores.reduce((sum, score) => sum + score, 0),
    failedRecords: values.filter(isFailedRecord_),
    dutyByZone: getCouncilDutyByZone_(range.startKey),
  };
}

function buildMonthlyCleaningSummary_(records, monthKey, config) {
  const latestByDateZone = {};
  records.forEach((record, index) => {
    const dateKey = normalizeRecordDate_(record.date, config.timeZone);
    const zoneId = Number(record.zoneId);
    if (
      String(dateKey).slice(0, 7) !== monthKey ||
      !Number.isInteger(zoneId) ||
      zoneId < 1 ||
      zoneId > 9
    ) {
      return;
    }
    const key = `${dateKey}|${zoneId}`;
    const candidate = Object.assign({}, record, {
      _sourceIndex: index,
      _dateKey: dateKey,
    });
    if (!latestByDateZone[key] || compareRecordOrder_(candidate, latestByDateZone[key]) >= 0) {
      latestByDateZone[key] = candidate;
    }
  });

  const workdays = listSchoolWorkdaysInMonth_(monthKey, config.timeZone);
  const values = Object.keys(latestByDateZone).map(
    (key) => latestByDateZone[key]
  );
  const days = workdays.map((dateKey) => {
    const dayRecords = values.filter((record) => record._dateKey === dateKey);
    return {
      dateKey,
      checkedCount: dayRecords.length,
      failedCount: dayRecords.filter(isFailedRecord_).length,
    };
  });
  const checkedSlots = days.reduce((sum, day) => sum + day.checkedCount, 0);
  const totalSlots = workdays.length * CLEANING_MESSENGER.TOTAL_ZONES;
  const failedRecords = values.filter(isFailedRecord_);
  const notableRecords = values
    .filter(
      (record) => isFailedRecord_(record) || String(record.notes || "").trim()
    )
    .sort((left, right) => String(left._dateKey).localeCompare(String(right._dateKey)));

  const zoneStats = CLEANING_MESSENGER.ZONES.map((zone) => {
    const zoneRecords = values.filter(
      (record) => Number(record.zoneId) === zone.id
    );
    const scores = zoneRecords
      .map((record) => Number(record.score))
      .filter(Number.isFinite);
    return {
      zone,
      reportedDays: zoneRecords.length,
      failedCount: zoneRecords.filter(isFailedRecord_).length,
      averageScore: scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null,
    };
  });

  const withImages = notableRecords
    .concat(values.slice().reverse())
    .filter((record) => Array.isArray(record.images) && record.images.length);
  const seen = {};
  const representativeRecords = withImages.filter((record) => {
    const key = String(record.id || `${record._dateKey}|${record.zoneId}`);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  return {
    monthKey,
    workdayCount: workdays.length,
    checkedSlots,
    totalSlots,
    coveragePercent: totalSlots
      ? Math.round((checkedSlots / totalSlots) * 100)
      : 0,
    completeDays: days.filter((day) => day.checkedCount === 9).length,
    partialDays: days.filter(
      (day) => day.checkedCount > 0 && day.checkedCount < 9
    ).length,
    noDataDays: days.filter((day) => day.checkedCount === 0).length,
    days,
    failedRecords,
    notableRecords,
    zoneStats,
    representativeRecords,
  };
}

function listSchoolWorkdaysInMonth_(monthKey, timeZone) {
  const parts = String(monthKey).split("-").map(Number);
  const lastDay = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
  const todayKey = dateKeyInTimeZone_(new Date(), timeZone);
  const isCurrentMonth = String(todayKey).slice(0, 7) === monthKey;
  const endDay = isCurrentMonth ? Number(todayKey.slice(8, 10)) : lastDay;
  const days = [];
  for (let day = 1; day <= endDay; day += 1) {
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, day));
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days.push(`${monthKey}-${String(day).padStart(2, "0")}`);
    }
  }
  return days;
}

function buildTodaySituationMessage_(snapshot, config, now) {
  const lines = [
    "🧭 สถานการณ์การตรวจความสะอาดวันนี้",
    "",
    thaiDateLabel_(snapshot.dateKey),
    `ข้อมูล ณ เวลา ${Utilities.formatDate(now, config.timeZone, "HH:mm")} น.`,
    "",
  ];
  const notable = snapshot.checkedZoneIds
    .map((zoneId) => snapshot.recordsByZone[zoneId])
    .filter(
      (record) => isFailedRecord_(record) || String(record.notes || "").trim()
    );
  if (!notable.length) {
    lines.push("✅ ยังไม่พบเหตุการณ์ผิดปกติหรือหมายเหตุสำคัญ");
  } else {
    lines.push(`พบเหตุการณ์หรือหมายเหตุ ${notable.length} รายการ`);
    notable.forEach((record) => {
      const zone = CLEANING_MESSENGER.ZONES.find(
        (item) => item.id === Number(record.zoneId)
      );
      lines.push(
        "",
        `• ${zone ? `${zone.name} · ${zone.className}` : `เขต ${record.zoneId}`}`,
        `  คะแนน ${record.score}/3 · ${thaiInspectionStatus_(record.status)}`,
        `  ${String(record.notes || "ไม่มีหมายเหตุ")}`
      );
    });
  }
  if (snapshot.missingZones.length) {
    lines.push(
      "",
      `⚠️ ยังไม่รายงาน ${snapshot.missingZones.length} เขต`,
      ...formatZoneDutyLines_(snapshot.missingZones, snapshot.dutyByZone)
    );
  }
  lines.push("", `🔗 ${config.appUrl}`);
  return lines.join("\n");
}

function buildMonthlyCleaningSummaryMessage_(summary, config) {
  const lines = [
    `📊 สรุปผลประจำเดือน ${thaiMonthYearLabel_(summary.monthKey)}`,
    "",
    `ความครอบคลุม ${summary.coveragePercent}%`,
    `ตรวจครบ 9 เขต: ${summary.completeDays} วัน`,
    `ตรวจบางส่วน: ${summary.partialDays} วัน`,
    `ไม่มีข้อมูล: ${summary.noDataDays} วัน`,
    `รายการไม่ผ่าน: ${summary.failedRecords.length} รายการ`,
    "",
    "ผลรายเขต",
  ];
  summary.zoneStats.forEach((item) => {
    lines.push(
      `• ${item.zone.name} ${item.zone.className}: ` +
        `${item.reportedDays}/${summary.workdayCount} วัน` +
        `${item.failedCount ? ` · ไม่ผ่าน ${item.failedCount}` : ""}`
    );
  });
  lines.push("", "พิมพ์ “PDF เดือนนี้” เพื่อรับรายงานฉบับเต็มพร้อมภาพ");
  lines.push(`🔗 ${config.appUrl}`);
  return lines.join("\n");
}

function getCleaningReportFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty("CLEANING_REPORT_FOLDER_ID");
  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (error) {
      console.error(`เปิดโฟลเดอร์รายงานเดิมไม่สำเร็จ: ${error}`);
    }
  }
  const folder = DriveApp.createFolder("Cleaning System Reports");
  properties.setProperty("CLEANING_REPORT_FOLDER_ID", folder.getId());
  return folder;
}

function appendReportTitle_(body, title, subtitle) {
  body.appendParagraph(title)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph(subtitle)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendHorizontalRule();
}

function styleReportTable_(table, options) {
  if (!table || table.getNumRows() < 1) return;
  const settings = options || {};
  const columnWidths = Array.isArray(settings.columnWidths)
    ? settings.columnWidths
    : [];

  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
    const row = table.getRow(rowIndex);
    for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex += 1) {
      const cell = row.getCell(cellIndex);
      if (rowIndex === 0) cell.setBackgroundColor("#D1FAE5");
      if (columnWidths[cellIndex]) cell.setWidth(columnWidths[cellIndex]);
      try {
        cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      } catch (error) {
        console.error(`จัดกึ่งกลางแนวตั้งไม่สำเร็จ: ${error}`);
      }

      for (let childIndex = 0; childIndex < cell.getNumChildren(); childIndex += 1) {
        try {
          const paragraph = cell.getChild(childIndex).asParagraph();
          paragraph
            .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
            .setSpacingBefore(0)
            .setSpacingAfter(0)
            .setLineSpacing(1);
          paragraph
            .editAsText()
            .setBold(rowIndex === 0)
            .setFontFamily("TH Sarabun New")
            .setFontSize(13);
        } catch (error) {
          console.error(`จัดกึ่งกลางข้อความในตารางไม่สำเร็จ: ${error}`);
        }
      }
    }
  }
}

function styleReportTableHeader_(table) {
  styleReportTable_(table);
}

function appendReportSignatureBlock_(body) {
  body.appendParagraph("");
  const signatureTable = body.appendTable([
    [
      "ลงชื่อ ..........................................",
      "ลงชื่อ ..........................................",
      "ลงชื่อ ..........................................",
    ],
    ["(........................................)", "(........................................)", "(........................................)"],
    [
      "ประธานนักเรียน",
      "ครูกิจการและพัฒนานักเรียน",
      "ผู้อำนวยการโรงเรียน",
    ],
  ]);
  signatureTable.setBorderWidth(0);
  for (let rowIndex = 0; rowIndex < signatureTable.getNumRows(); rowIndex += 1) {
    const row = signatureTable.getRow(rowIndex);
    for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex += 1) {
      const cell = row.getCell(cellIndex);
      cell.setWidth(150);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      const paragraph = cell.getChild(0).asParagraph();
      paragraph
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setSpacingBefore(rowIndex === 0 ? 12 : 0)
        .setSpacingAfter(0);
      paragraph
        .editAsText()
        .setBold(rowIndex === 2)
        .setFontFamily("TH Sarabun New")
        .setFontSize(13);
    }
  }
}

function appendReportImages_(body, records, maxImages, config) {
  let appended = 0;
  records.forEach((record) => {
    if (appended >= maxImages) return;
    const sourceImages = Array.isArray(record.images)
      ? record.images.slice(0, 3)
      : [];
    const blobs = [];
    sourceImages.forEach((url) => {
      if (appended + blobs.length >= maxImages) return;
      const blob = fetchReportImageBlob_(url);
      if (blob) blobs.push(blob);
    });
    if (!blobs.length) return;

    const zone = CLEANING_MESSENGER.ZONES.find(
      (item) => item.id === Number(record.zoneId)
    );
    const dateLabel = thaiDateLabel_(
      normalizeRecordDate_(record.date, config.timeZone)
    );
    const scoreLabel =
      record.score === "" || record.score === null || record.score === undefined
        ? "-"
        : `${record.score}/3`;
    const heading = body.appendParagraph(
      `${zone ? `${zone.name} - ${zone.className}` : `เขต ${record.zoneId}`} ` +
        `(วันที่: ${dateLabel})    คะแนน: ${scoreLabel}    ` +
        `หมายเหตุ: ${String(record.notes || "-")}`
    );
    heading
      .setSpacingBefore(10)
      .setSpacingAfter(4)
      .editAsText()
      .setBold(true)
      .setFontFamily("TH Sarabun New")
      .setFontSize(13);

    const photoTable = body.appendTable([["", "", ""]]);
    photoTable.setBorderColor("#CBD5E1");
    photoTable.setBorderWidth(0.5);
    const row = photoTable.getRow(0);
    for (let index = 0; index < 3; index += 1) {
      const cell = row.getCell(index);
      cell.setWidth(150);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      const paragraph = cell.getChild(0).asParagraph();
      paragraph
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setSpacingBefore(2)
        .setSpacingAfter(2);
      if (!blobs[index]) {
        paragraph.appendText("ไม่มีรูป").setForegroundColor("#64748B");
        continue;
      }
      try {
        const image = paragraph.appendInlineImage(blobs[index]);
        const width = Math.max(1, image.getWidth());
        const height = Math.max(1, image.getHeight());
        const scale = Math.min(140 / width, 105 / height);
        image.setWidth(Math.max(1, Math.round(width * scale)));
        image.setHeight(Math.max(1, Math.round(height * scale)));
        appended += 1;
      } catch (error) {
        console.error(`เพิ่มภาพลงรายงานไม่สำเร็จ: ${error}`);
        paragraph.appendText("เปิดรูปไม่ได้").setForegroundColor("#B91C1C");
      }
    }
    body.appendParagraph("").setSpacingAfter(4);
  });
  if (!appended) body.appendParagraph("ไม่มีภาพประกอบที่เปิดใช้งานได้");
}

function fetchReportImageBlob_(url) {
  const source = String(url || "").trim();
  const dataUrl = source.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i
  );
  if (dataUrl) {
    if (dataUrl[2].length > CLEANING_MESSENGER.MAX_REPORT_IMAGE_DATA_CHARS) {
      console.error("ข้ามรูป data URL ที่มีขนาดใหญ่เกินกำหนด");
      return null;
    }
    try {
      const bytes = Utilities.base64Decode(dataUrl[2]);
      if (bytes.length > CLEANING_MESSENGER.MAX_REPORT_IMAGE_BYTES) {
        console.error("ข้ามรูป data URL ที่มีขนาดใหญ่เกินกำหนด");
        return null;
      }
      return Utilities.newBlob(bytes, dataUrl[1], "report-image");
    } catch (error) {
      console.error(`อ่านรูปแบบ data URL ไม่สำเร็จ: ${error}`);
      return null;
    }
  }
  const urlParts = source.match(/^https:\/\/([^/:?#]+)(?:[/:?#]|$)/i);
  if (!urlParts) return null;
  const host = String(urlParts[1] || "").toLowerCase().replace(/\.$/, "");
  if (!(host === "googleusercontent.com" || /\.googleusercontent\.com$/.test(host))) {
    console.error(`ข้ามโฮสต์รูปภาพที่ไม่ได้รับอนุญาต: ${host || "unknown"}`);
    return null;
  }
  const options = {
    method: "get",
    followRedirects: false,
    muteHttpExceptions: true,
  };
  try {
    const response = UrlFetchApp.fetch(source, options);
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      return null;
    }
    const blob = response.getBlob();
    const contentType = String(blob.getContentType() || "").toLowerCase();
    if (!/^image\/(?:jpeg|png|webp)$/.test(contentType)) return null;
    if (blob.getBytes().length > CLEANING_MESSENGER.MAX_REPORT_IMAGE_BYTES) {
      console.error("ข้ามรูปจาก URL ที่มีขนาดใหญ่เกินกำหนด");
      return null;
    }
    return blob;
  } catch (error) {
    console.error(`โหลดภาพรายงานไม่สำเร็จ: ${error}`);
    return null;
  }
}

function appendReportFooter_(body, config) {
  body.appendHorizontalRule();
  const footer = body.appendParagraph(
    `สร้างโดยระบบตรวจเวรทำความสะอาด ${config.schoolName}\n${config.appUrl}`
  );
  footer.editAsText().setForegroundColor("#64748B");
}

function sendMessengerPdfAttachmentToOne_(pdfBlob, recipientId, config) {
  const uploadEndpoint = `https://graph.facebook.com/${encodeURIComponent(
    config.graphVersion
  )}/${encodeURIComponent(config.pageId)}/message_attachments`;
  const uploadResponse = UrlFetchApp.fetch(uploadEndpoint, {
    method: "post",
    headers: { Authorization: `Bearer ${config.pageAccessToken}` },
    payload: {
      message: JSON.stringify({
        attachment: { type: "file", payload: { is_reusable: true } },
      }),
      filedata: pdfBlob,
    },
    muteHttpExceptions: true,
  });
  const uploadCode = uploadResponse.getResponseCode();
  const uploadBody = uploadResponse.getContentText();
  if (uploadCode < 200 || uploadCode >= 300) {
    throw new Error(`อัปโหลด PDF ไป Meta ไม่สำเร็จ HTTP ${uploadCode}: ${uploadBody}`);
  }
  const uploaded = JSON.parse(uploadBody);
  if (!uploaded.attachment_id) {
    throw new Error("Meta ไม่ส่ง attachment_id กลับมา");
  }

  const endpoint = `https://graph.facebook.com/${encodeURIComponent(
    config.graphVersion
  )}/${encodeURIComponent(config.pageId)}/messages`;
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${config.pageAccessToken}` },
    payload: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: config.messagingType,
      message: {
        attachment: {
          type: "file",
          payload: { attachment_id: uploaded.attachment_id },
        },
      },
    }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(
      `ส่ง PDF ไป Messenger ไม่สำเร็จ HTTP ${response.getResponseCode()}: ${response.getContentText()}`
    );
  }
}

function queueAutomaticCleaningReports_(state, config, now) {
  const dateKey = dateKeyInTimeZone_(now, config.timeZone);
  const currentTime = Utilities.formatDate(now, config.timeZone, "HH:mm");
  let queued = 0;

  if (
    config.autoDailyPdf &&
    !isWeekendDateKey_(dateKey) &&
    compareClockTimes_(currentTime, config.endOfDayTime) >= 0
  ) {
    const key = `${dateKey}|automatic_daily_pdf`;
    if (!state.sent[key]) {
      config.adminRecipientIds.forEach((recipientId) => {
        if (
          enqueueCleaningReportJob_("daily_pdf", recipientId, config, {
            dateKey,
            messagingType: "UPDATE",
          })
        ) {
          queued += 1;
        }
      });
      state.sent[key] = now.toISOString();
    }
  }

  if (
    config.autoMonthlyPdf &&
    isFirstSchoolWorkdayOfMonth_(dateKey) &&
    compareClockTimes_(currentTime, "09:00") >= 0
  ) {
    const previousMonthKey = shiftMonthKey_(String(dateKey).slice(0, 7), -1);
    const key = `${previousMonthKey}|automatic_monthly_pdf`;
    if (!state.sent[key]) {
      config.adminRecipientIds.forEach((recipientId) => {
        if (
          enqueueCleaningReportJob_("monthly_pdf", recipientId, config, {
            monthKey: previousMonthKey,
            messagingType: "UPDATE",
          })
        ) {
          queued += 1;
        }
      });
      state.sent[key] = now.toISOString();
    }
  }
  return queued;
}

function isFirstSchoolWorkdayOfMonth_(dateKey) {
  const parts = String(dateKey).split("-").map(Number);
  for (let day = 1; day <= parts[2]; day += 1) {
    const weekday = new Date(Date.UTC(parts[0], parts[1] - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) return day === parts[2];
  }
  return false;
}

/** Manual tests from the Apps Script editor. */
function createDailyCleaningPdfNow() {
  const config = getCleaningMessengerConfig_();
  const dateKey = dateKeyInTimeZone_(new Date(), config.timeZone);
  const report = createDailyCleaningReportPdf_(config, dateKey);
  console.log(report.url);
  return report.url;
}

function createWeeklyCleaningPdfNow() {
  const config = getCleaningMessengerConfig_();
  const dateKey = dateKeyInTimeZone_(new Date(), config.timeZone);
  const report = createWeeklyCleaningReportPdf_(config, dateKey);
  console.log(report.url);
  return report.url;
}

function createMonthlyCleaningPdfNow() {
  const config = getCleaningMessengerConfig_();
  const monthKey = dateKeyInTimeZone_(new Date(), config.timeZone).slice(0, 7);
  const report = createMonthlyCleaningReportPdf_(config, monthKey);
  console.log(report.url);
  return report.url;
}

/**
 * Interactive Messenger commands for approved recipients.
 *
 * Supported examples:
 * - สรุปวันนี้
 * - ตารางสัปดาห์นี้
 * - ตารางสัปดาห์หน้า
 * - ตารางสัปดาห์ 1
 * - ตารางเดือนนี้
 * - PDF วันนี้
 * - PDF สัปดาห์นี้
 * - เมนู
 */
function handleCleaningMessengerCommand_(text, senderId, config, metadata) {
  if (!config.commandsEnabled) return false;
  if (!isApprovedMessengerCommandSender_(senderId, config)) {
    console.log(`ข้ามคำสั่งจาก PSID ที่ยังไม่ได้รับอนุญาต: ${senderId}`);
    return false;
  }

  const command = parseCleaningMessengerCommand_(text);
  if (
    command.type === "daily_pdf" ||
    command.type === "weekly_pdf" ||
    command.type === "monthly_pdf"
  ) {
    const todayKey = dateKeyInTimeZone_(new Date(), config.timeZone);
    const requestedDateKey =
      command.type === "weekly_pdf"
        ? addDaysToDateKey_(todayKey, Number(command.weekOffset || 0) * 7)
        : todayKey;
    const queued = enqueueCleaningReportJob_(
      command.type,
      senderId,
      config,
      {
        messageId: metadata && metadata.messageId,
        messagingType: "RESPONSE",
        dateKey: requestedDateKey,
        weekStartKey:
          command.type === "weekly_pdf"
            ? getSchoolWeekRange_(requestedDateKey).startKey
            : undefined,
      }
    );
    sendMessengerReply_(
      queued
        ? "⏳ รับคำขอแล้ว กำลังจัดทำรายงาน PDF พร้อมภาพ ระบบจะส่งไฟล์ให้ภายในประมาณ 1–2 นาที"
        : "⏳ คำขอนี้อยู่ระหว่างจัดทำ กรุณารอสักครู่",
      senderId,
      config
    );
    return true;
  }
  let messages;

  try {
    messages = buildCleaningMessengerCommandReplies_(command, config);
  } catch (error) {
    console.error(
      `ประมวลผลคำสั่ง Messenger ไม่สำเร็จ: ${
        (error && error.stack) || error
      }`
    );
    messages = [
      [
        "⚠️ ขออภัย ระบบอ่านข้อมูลไม่สำเร็จในขณะนี้",
        "กรุณาลองใหม่อีกครั้ง หรือตรวจสอบจากหน้าเว็บ",
        "",
        `🔗 ${config.appUrl}`,
      ].join("\n"),
    ];
  }

  messages.forEach((message) => {
    sendMessengerReply_(message, senderId, config);
  });
  return true;
}

function isApprovedMessengerCommandSender_(senderId, config) {
  const allowed = config.commandsAdminOnly
    ? config.adminRecipientIds
    : Array.from(
        new Set(config.recipientIds.concat(config.adminRecipientIds))
      );
  return allowed.indexOf(String(senderId || "")) >= 0;
}

function parseCleaningMessengerCommand_(text) {
  const normalized = String(text || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!normalized) return { type: "help" };
  if (/^(เมนู|ช่วยเหลือ|คำสั่ง|help|\/help)$/.test(normalized)) {
    return { type: "help" };
  }

  if (
    /(pdf.*(วันนี้|ประจำวัน|รายวัน|แต่ละวัน)|(วันนี้|ประจำวัน|รายวัน|แต่ละวัน).*pdf|ไฟล์.*(วันนี้|ประจำวัน|รายวัน|แต่ละวัน))/i.test(
      normalized
    )
  ) {
    return { type: "daily_pdf" };
  }

  if (
    /(pdf.*(สัปดาห์นี้|สัปดาห์หน้า|สัปดาห์ก่อน|สัปดาห์ที่แล้ว|ประจำสัปดาห์|รายสัปดาห์)|(สัปดาห์นี้|สัปดาห์หน้า|สัปดาห์ก่อน|สัปดาห์ที่แล้ว|ประจำสัปดาห์|รายสัปดาห์).*pdf|ไฟล์.*(สัปดาห์นี้|สัปดาห์หน้า|สัปดาห์ก่อน|สัปดาห์ที่แล้ว|ประจำสัปดาห์|รายสัปดาห์)|(ส่ง|ขอ).*รายงาน.*(ประจำสัปดาห์|รายสัปดาห์))/i.test(
      normalized
    )
  ) {
    const weekOffset = /(สัปดาห์หน้า)/.test(normalized)
      ? 1
      : /(สัปดาห์ก่อน|สัปดาห์ที่แล้ว)/.test(normalized)
      ? -1
      : 0;
    return { type: "weekly_pdf", weekOffset };
  }

  if (
    /(pdf.*(เดือนนี้|ประจำเดือน)|(เดือนนี้|ประจำเดือน).*pdf|ไฟล์.*(เดือนนี้|ประจำเดือน))/i.test(
      normalized
    )
  ) {
    return { type: "monthly_pdf" };
  }

  if (
    /(สถานการณ์วันนี้|เหตุการณ์วันนี้|ปัญหา.*วันนี้|วันนี้.*เป็นอย่างไร|วันนี้.*มีอะไร|สภาพ.*วันนี้)/.test(
      normalized
    )
  ) {
    return { type: "today_situation" };
  }

  if (
    /(สรุป.*เดือนนี้|รายงานเดือนนี้|รายงานประจำเดือน|เดือนนี้.*เป็นอย่างไร|สถิติเดือนนี้|ผล.*เดือนนี้)/.test(
      normalized
    )
  ) {
    return { type: "month_summary" };
  }

  if (
    /(ตารางเดือนนี้|ตารางทั้งเดือน|ตารางทุกสัปดาห์|ตารางตรวจเวรแต่ละสัปดาห์|เวรทั้งเดือน)/.test(
      normalized
    )
  ) {
    return { type: "month" };
  }

  const numberedWeek = normalized.match(/(?:ตาราง|เวร).*สัปดาห์(?:ที่)?\s*([1-6])/);
  if (numberedWeek) {
    return { type: "week_number", weekNumber: Number(numberedWeek[1]) };
  }

  if (/(ตาราง|เวร).*สัปดาห์หน้า/.test(normalized)) {
    return { type: "next_week" };
  }

  if (
    /(ตารางสัปดาห์นี้|เวรสัปดาห์นี้|เวรวันนี้|เวรประจำวัน|ใครตรวจวันนี้|ผู้รับผิดชอบวันนี้|ตารางตรวจเวร|ตารางเวร|ขอตาราง)/.test(
      normalized
    )
  ) {
    return { type: "current_week" };
  }

  if (
    /(สรุปวันนี้|รายงานวันนี้|ตรวจวันนี้|ยังไม่ตรวจ|แจ้งเตือน.*ความสะอาด|ความสะอาด.*วันนี้)/.test(
      normalized
    )
  ) {
    return { type: "today" };
  }

  return { type: "help" };
}

function buildCleaningMessengerCommandReplies_(command, config) {
  const now = new Date();
  const dateKey = dateKeyInTimeZone_(now, config.timeZone);

  if (command.type === "today") {
    const snapshot = getCleaningSnapshot_(config, now);
    return [buildOnDemandCleaningStatusMessage_(snapshot, config, now)];
  }

  if (command.type === "today_situation") {
    const snapshot = getCleaningSnapshot_(config, now);
    return [buildTodaySituationMessage_(snapshot, config, now)];
  }

  if (command.type === "month_summary") {
    const records = fetchCleaningRecords_(config);
    const summary = buildMonthlyCleaningSummary_(
      records,
      String(dateKey).slice(0, 7),
      config
    );
    return [buildMonthlyCleaningSummaryMessage_(summary, config)];
  }

  if (command.type === "current_week") {
    return [buildCouncilWeekReplyForDate_(dateKey, config)];
  }

  if (command.type === "next_week") {
    return [buildCouncilWeekReplyForDate_(addDaysToDateKey_(dateKey, 7), config)];
  }

  if (command.type === "week_number") {
    const schedule = loadPublishedCouncilDutySchedule_(
      String(dateKey).slice(0, 7)
    );
    if (!schedule) {
      return [buildCouncilScheduleNotFoundMessage_(config)];
    }
    const week = schedule.weeks[command.weekNumber - 1];
    if (!week) {
      return [
        `ไม่พบสัปดาห์ที่ ${command.weekNumber} ในตารางเดือนนี้\n\nพิมพ์ “ตารางเดือนนี้” เพื่อดูสัปดาห์ที่มี`,
      ];
    }
    return [buildCouncilDutyWeekMessage_(schedule, week, config)];
  }

  if (command.type === "month") {
    const schedule = loadPublishedCouncilDutySchedule_(
      String(dateKey).slice(0, 7)
    );
    if (!schedule) {
      return [buildCouncilScheduleNotFoundMessage_(config)];
    }
    return [
      `📅 ตารางตรวจเวรประจำเดือน ${thaiMonthYearLabel_(schedule.key)}\nส่งทั้งหมด ${schedule.weeks.length} สัปดาห์`,
    ].concat(
      schedule.weeks.map((week) =>
        buildCouncilDutyWeekMessage_(schedule, week, config)
      )
    );
  }

  return [buildCleaningMessengerHelpMessage_()];
}

function buildOnDemandCleaningStatusMessage_(snapshot, config, now) {
  const percent = Math.round(
    (snapshot.checkedCount / CLEANING_MESSENGER.TOTAL_ZONES) * 100
  );
  const time = Utilities.formatDate(now, config.timeZone, "HH:mm");
  const lines = [
    "📋 รายงานการตรวจความสะอาดล่าสุด",
    "",
    thaiDateLabel_(snapshot.dateKey),
    `ข้อมูล ณ เวลา ${time} น.`,
    "",
    `✅ ตรวจแล้ว ${snapshot.checkedCount}/${CLEANING_MESSENGER.TOTAL_ZONES} เขต — ${percent}%`,
    `⚠️ ยังไม่ได้ตรวจ ${snapshot.missingZones.length} เขต`,
    `❌ เขตไม่ผ่าน ${snapshot.failedRecords.length} เขต`,
  ];

  if (snapshot.missingZones.length) {
    lines.push(
      "",
      "เขตที่ยังไม่ได้รายงาน",
      ...formatZoneDutyLines_(snapshot.missingZones, snapshot.dutyByZone)
    );
  } else {
    lines.push("", "🎉 วันนี้รายงานครบทุกเขตแล้ว");
  }

  lines.push("", "🔗 เปิดระบบตรวจความสะอาด", config.appUrl);
  return lines.join("\n");
}

function buildCouncilWeekReplyForDate_(dateKey, config) {
  const resolved = findPublishedCouncilDutyWeekForDate_(dateKey);
  if (!resolved) return buildCouncilScheduleNotFoundMessage_(config);
  return buildCouncilDutyWeekMessage_(
    resolved.schedule,
    resolved.week,
    config
  );
}

function buildCouncilDutyWeekMessage_(schedule, week, config) {
  const dutyByZone = getCouncilDutyByZoneForWeek_(schedule, week);
  const lines = [
    `📅 ตารางตรวจเวร ${week.label || ""}`.trim(),
    "",
    formatThaiDateRange_(week.start, week.end),
    "",
  ];

  CLEANING_MESSENGER.ZONES.forEach((zone) => {
    lines.push(`• ${zone.name} · ${zone.className}`);
    lines.push(`  ${formatCouncilDutyLine_(dutyByZone[zone.id])}`);
  });

  lines.push("", "🔗 เปิดระบบตรวจความสะอาด", config.appUrl);
  return lines.join("\n");
}

function getCouncilDutyByZoneForWeek_(schedule, week) {
  if (!schedule || !week || !Array.isArray(schedule.groups)) return {};
  const assignments =
    (schedule.assignments && schedule.assignments[week.id]) || {};
  const dutyByZone = {};

  schedule.groups.forEach((group, index) => {
    const zoneId = Number(assignments[group.id]);
    if (!Number.isInteger(zoneId) || zoneId < 1 || zoneId > 9) return;
    dutyByZone[zoneId] = {
      groupNumber: index + 1,
      accountId: String(group.accountId || "").trim(),
      members: Array.isArray(group.members)
        ? group.members.map((name) => String(name).trim()).filter(Boolean)
        : [],
    };
  });
  return dutyByZone;
}

function loadPublishedCouncilDutySchedule_(scheduleKey) {
  const raw = PropertiesService.getScriptProperties().getProperty(
    councilDutySchedulePropertyKey_(scheduleKey)
  );
  if (!raw) return null;

  try {
    const schedule = JSON.parse(raw);
    return schedule &&
      schedule.published &&
      Array.isArray(schedule.weeks) &&
      Array.isArray(schedule.groups)
      ? schedule
      : null;
  } catch (error) {
    return null;
  }
}

function findPublishedCouncilDutyWeekForDate_(dateKey) {
  const monthKey = String(dateKey).slice(0, 7);
  const scheduleKeys = [
    monthKey,
    shiftMonthKey_(monthKey, -1),
    shiftMonthKey_(monthKey, 1),
  ];

  for (let index = 0; index < scheduleKeys.length; index += 1) {
    const schedule = loadPublishedCouncilDutySchedule_(scheduleKeys[index]);
    if (!schedule) continue;
    const week = schedule.weeks.find(
      (item) => dateKey >= item.start && dateKey <= item.end
    );
    if (week) return { schedule, week };
  }
  return null;
}

function shiftMonthKey_(monthKey, delta) {
  const parts = String(monthKey).split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1 + delta, 1));
  return Utilities.formatDate(date, "UTC", "yyyy-MM");
}

function addDaysToDateKey_(dateKey, days) {
  const parts = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return Utilities.formatDate(date, "UTC", "yyyy-MM-dd");
}

function getSchoolWeekRange_(dateKey) {
  const parts = String(dateKey).split("-").map(Number);
  const anchor = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const weekday = anchor.getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(anchor.getTime());
  monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
  const startKey = Utilities.formatDate(monday, "UTC", "yyyy-MM-dd");
  const dateKeys = [];
  for (let index = 0; index < 5; index += 1) {
    dateKeys.push(addDaysToDateKey_(startKey, index));
  }
  return {
    startKey,
    endKey: dateKeys[dateKeys.length - 1],
    dateKeys,
  };
}

function formatThaiDateRange_(startKey, endKey) {
  const start = String(startKey).split("-").map(Number);
  const end = String(endKey).split("-").map(Number);
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  if (start[0] === end[0] && start[1] === end[1]) {
    return `${start[2]}–${end[2]} ${months[start[1] - 1]} ${start[0] + 543}`;
  }
  return `${start[2]} ${months[start[1] - 1]} ${start[0] + 543} – ${end[2]} ${
    months[end[1] - 1]
  } ${end[0] + 543}`;
}

function thaiMonthYearLabel_(monthKey) {
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const parts = String(monthKey).split("-").map(Number);
  return `${months[parts[1] - 1]} ${parts[0] + 543}`;
}

function buildCouncilScheduleNotFoundMessage_(config) {
  return [
    "ℹ️ ยังไม่พบตารางเวรที่เผยแพร่สำหรับช่วงเวลานี้",
    "กรุณาให้แอดมินเปิดตาราง จัดเวร และกด “เผยแพร่ตาราง”",
    "",
    `🔗 ${config.appUrl}`,
  ].join("\n");
}

function buildCleaningMessengerHelpMessage_() {
  return [
    "🤖 คำสั่งระบบตรวจความสะอาด",
    "",
    "พิมพ์ข้อความต่อไปนี้ได้เลย",
    "• สรุปวันนี้",
    "• สถานการณ์วันนี้",
    "• เวรวันนี้",
    "• ตารางสัปดาห์หน้า",
    "• ตารางสัปดาห์ 1",
    "• ตารางเดือนนี้",
    "• สรุปเดือนนี้",
    "• PDF วันนี้",
    "• PDF สัปดาห์นี้",
    "• PDF สัปดาห์หน้า",
    "• PDF เดือนนี้",
    "• เมนู",
  ].join("\n");
}

function sendMessengerReply_(message, senderId, config) {
  const responseConfig = Object.assign({}, config, {
    messagingType: "RESPONSE",
  });
  splitMessengerText_(message, 1900).forEach((chunk) => {
    sendMessengerTextToOne_(chunk, senderId, responseConfig);
  });
}

function splitMessengerText_(message, limit) {
  const safeLimit = Math.max(200, Number(limit) || 1900);
  const lines = String(message || "").split("\n");
  const chunks = [];
  let current = "";

  lines.forEach((line) => {
    let remaining = line;
    while (remaining.length > safeLimit) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(remaining.slice(0, safeLimit));
      remaining = remaining.slice(safeLimit);
    }
    const candidate = current ? current + "\n" + remaining : remaining;
    if (candidate.length > safeLimit) {
      chunks.push(current);
      current = remaining;
    } else {
      current = candidate;
    }
  });
  if (current) chunks.push(current);
  return chunks.length ? chunks : [""];
}

/**
 * Meta webhook routing helpers.
 *
 * Add maybeHandleMetaWebhookGet(e) at the beginning of the existing doGet(e),
 * and maybeHandleMetaWebhookPost(e) at the beginning of the existing doPost(e).
 * Newly discovered PSIDs stay pending until explicitly approved.
 */
function maybeHandleMetaWebhookGet(e) {
  const parameters = (e && e.parameter) || {};
  if (parameters.action === "getCouncilSchedule") {
    return handleCouncilDutyScheduleGet_(parameters.key);
  }
  if (!parameters["hub.mode"]) return null;

  const config = getCleaningMessengerConfig_();
  const valid =
    parameters["hub.mode"] === "subscribe" &&
    parameters["hub.verify_token"] === config.webhookVerifyToken;
  return ContentService.createTextOutput(
    valid ? parameters["hub.challenge"] || "" : "Verification failed"
  ).setMimeType(ContentService.MimeType.TEXT);
}

function maybeHandleMetaWebhookPost(e) {
  if (!e || !e.postData || !e.postData.contents) return null;

  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    return null;
  }
  if (payload && payload.action === "saveCouncilSchedule") {
    return handleCouncilDutySchedulePost_(payload);
  }
  if (!payload || payload.object !== "page" || !Array.isArray(payload.entry)) {
    return null;
  }

  const config = getCleaningMessengerConfig_();
  const discovered = [];
  const incomingCommands = [];
  payload.entry.forEach((entry) => {
    (entry.messaging || []).forEach((event) => {
      const recipientId = String((event.recipient && event.recipient.id) || "");
      const senderId = String((event.sender && event.sender.id) || "");
      if (
        senderId &&
        senderId !== config.pageId &&
        (!config.pageId || recipientId === config.pageId)
      ) {
        discovered.push(senderId);
        if (
          event.message &&
          !event.message.is_echo &&
          typeof event.message.text === "string"
        ) {
          incomingCommands.push({
            senderId,
            text: event.message.text,
            messageId: String(event.message.mid || ""),
          });
        }
      }
    });
  });

  storePendingMessengerRecipients_(discovered);
  incomingCommands.forEach((command) => {
    try {
      handleCleaningMessengerCommand_(
        command.text,
        command.senderId,
        config,
        { messageId: command.messageId }
      );
    } catch (error) {
      console.error(
        `ตอบคำสั่ง Messenger ไม่สำเร็จ: ${(error && error.stack) || error}`
      );
    }
  });
  return ContentService.createTextOutput("EVENT_RECEIVED").setMimeType(
    ContentService.MimeType.TEXT
  );
}

function storePendingMessengerRecipients_(recipientIds) {
  if (!recipientIds.length) return;
  const properties = PropertiesService.getScriptProperties();
  const existing = parseRecipientIds_(
    properties.getProperty(CLEANING_MESSENGER.PENDING_RECIPIENTS_PROPERTY) || ""
  );
  const merged = Array.from(new Set(existing.concat(recipientIds)));
  properties.setProperty(
    CLEANING_MESSENGER.PENDING_RECIPIENTS_PROPERTY,
    merged.join(",")
  );
  console.log(`พบ PSID รออนุมัติ ${merged.length} รายการ`);
}

/**
 * Approves all PSIDs captured by the webhook as both normal and admin
 * recipients. This is intentionally a manual action to prevent arbitrary
 * webhook requests from silently subscribing a recipient.
 */
function approvePendingMessengerRecipients() {
  const properties = PropertiesService.getScriptProperties();
  const pending = parseRecipientIds_(
    properties.getProperty(CLEANING_MESSENGER.PENDING_RECIPIENTS_PROPERTY) || ""
  );
  if (!pending.length) {
    console.log("ไม่มี PSID รออนุมัติ");
    return;
  }

  const normal = parseRecipientIds_(
    properties.getProperty("MESSENGER_RECIPIENT_IDS") || ""
  );
  const admins = parseRecipientIds_(
    properties.getProperty("MESSENGER_ADMIN_RECIPIENT_IDS") || ""
  );
  properties.setProperty(
    "MESSENGER_RECIPIENT_IDS",
    Array.from(new Set(normal.concat(pending))).join(",")
  );
  properties.setProperty(
    "MESSENGER_ADMIN_RECIPIENT_IDS",
    Array.from(new Set(admins.concat(pending))).join(",")
  );
  properties.deleteProperty(CLEANING_MESSENGER.PENDING_RECIPIENTS_PROPERTY);
  console.log(`อนุมัติ PSID แล้ว ${pending.length} รายการ`);
}
