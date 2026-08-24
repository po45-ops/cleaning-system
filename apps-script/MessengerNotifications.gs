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

    saveNotificationState_(state);
    console.log(
      `ตรวจสำเร็จ ${snapshot.checkedCount}/${CLEANING_MESSENGER.TOTAL_ZONES} เขต; ส่ง ${sent} เหตุการณ์`
    );
    return { status: "ok", sent, checkedCount: snapshot.checkedCount };
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
  const raw = PropertiesService.getScriptProperties().getProperty(
    councilDutySchedulePropertyKey_(String(dateKey).slice(0, 7))
  );
  if (!raw) return {};

  let schedule;
  try {
    schedule = JSON.parse(raw);
  } catch (error) {
    return {};
  }
  if (!schedule || !schedule.published || !Array.isArray(schedule.weeks)) {
    return {};
  }
  const week = schedule.weeks.find(
    (item) => dateKey >= item.start && dateKey <= item.end
  );
  if (!week || !Array.isArray(schedule.groups)) return {};

  const weekAssignments =
    (schedule.assignments && schedule.assignments[week.id]) || {};
  const dutyByZone = {};
  schedule.groups.forEach((group, index) => {
    const zoneId = Number(weekAssignments[group.id]);
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
      }
    });
  });

  storePendingMessengerRecipients_(discovered);
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
