# ตั้งค่าแจ้งเตือน Facebook Messenger สำหรับ cleaning-system

ระบบนี้ส่งจาก **Facebook Page ไปยังแชทส่วนตัวของผู้ดูแล** โดยอ่านข้อความการตรวจจาก Google Sheets ผ่าน Google Apps Script เดิมของโครงการ

> สำคัญ: Messenger ไม่อนุญาตให้ส่งอัตโนมัติจากบัญชี Facebook ส่วนตัว และไม่รองรับการส่งเข้าแชทกลุ่มทั่วไปผ่าน API ทางการ

## สิ่งที่ระบบรองรับ

| เหตุการณ์ | การทำงาน |
| --- | --- |
| 09:00 และยังไม่ครบ | แจ้งเตือนครั้งที่ 1 |
| 12:00 และยังไม่ครบ | แจ้งจำนวนพร้อมรายชื่อเขต |
| 15:00 และยังไม่ครบ | แจ้งเตือนครั้งสุดท้าย |
| ตรวจครบ 9/9 | แจ้งสำเร็จภายในประมาณ 5 นาที หรือทันทีเมื่อเพิ่ม hook หลังบันทึก |
| คะแนน 0 (ไม่ผ่าน) | แจ้งผู้ดูแลแยกตามเขต |
| 16:30 | ส่งสรุปประจำวัน; เปลี่ยนเวลาได้ |
| หลังสรุปสิ้นวัน | สร้างและส่ง PDF ประจำวันพร้อมภาพประกอบ |
| วันทำการแรกของเดือน 09:00 | ส่ง PDF สรุปของเดือนก่อนหน้า |

ระบบตรวจเฉพาะวันจันทร์–วันศุกร์ และใช้เขตตามหน้าเว็บจริง: ป.1–ป.6 และ ม.1–ม.3

## 1. สร้าง Facebook Page

1. เปิด [หน้าสร้าง Facebook Page](https://www.facebook.com/pages/create)
2. ตั้งชื่อแนะนำ: `ระบบตรวจเวรทำความสะอาด โรงเรียนไตรธารวิทยา`
3. เลือกหมวดหมู่ `โรงเรียน` หรือ `การศึกษา`
4. ใส่คำอธิบายว่าเป็นเพจแจ้งเตือนภายในของโรงเรียน
5. เปิดใช้งานปุ่ม **ส่งข้อความ**

ไม่ต้องสร้างบัญชี Facebook ใหม่ และไม่ต้องส่งรหัสผ่านบัญชีส่วนตัวให้ผู้อื่น

## 2. สร้าง Meta App และเชื่อม Page

1. เปิด [Meta for Developers > My Apps](https://developers.facebook.com/apps/)
2. เลือก **Create App** แล้วเลือกกรณีใช้งานเกี่ยวกับ Messenger/Business Messaging
3. เพิ่มผลิตภัณฑ์ **Messenger** และเชื่อม Facebook Page ที่สร้างในขั้นตอนแรก
4. ที่ Token Generation เลือก Page แล้วสร้าง **Page Access Token**
5. ตรวจว่ามีสิทธิ์ `pages_messaging`

คู่มือทางการ: [Get Started – Messenger Platform](https://developers.facebook.com/documentation/business-messaging/messenger-platform/get-started)

ช่วงทดสอบสามารถใช้ App ใน Development mode ได้ หากผู้รับเป็นเจ้าของ/ผู้ดูแล/ผู้ทดสอบของ App เอง หากต้องการส่งให้บุคลากรอื่นในภายหลัง อาจต้องเปิด Live mode และผ่าน App Review ตามที่ Meta กำหนด

## 3. เพิ่มโมดูลลงใน Google Apps Script

1. เปิด Google Apps Script โครงการเดียวกับ URL ฐานข้อมูลของ cleaning-system
2. เพิ่มไฟล์ Script ใหม่ชื่อ `MessengerNotifications`
3. คัดลอกเนื้อหาจาก [`apps-script/MessengerNotifications.gs`](../apps-script/MessengerNotifications.gs) ไปวาง
4. กดบันทึก
5. รันฟังก์ชัน `initializeCleaningMessengerConfig` หนึ่งครั้ง และอนุญาตสิทธิ์ที่ Google ขอ

อย่าสร้าง `doGet` หรือ `doPost` ซ้ำ เพราะโครงการเดิมมีฟังก์ชันเหล่านี้สำหรับอ่านและบันทึกผลตรวจอยู่แล้ว

## 4. ตั้งค่า Script Properties

เปิด **Project Settings > Script Properties** แล้วเพิ่ม/ตรวจค่าต่อไปนี้

| Property | ค่า |
| --- | --- |
| `META_PAGE_ID` | ID ของ Facebook Page |
| `META_PAGE_ACCESS_TOKEN` | Page Access Token จาก Meta |
| `MESSENGER_ENABLED` | เริ่มด้วย `false` |
| `META_GRAPH_API_VERSION` | `v26.0` |
| `MESSENGER_MESSAGING_TYPE` | `UPDATE` |
| `CLEANING_TIME_ZONE` | `Asia/Bangkok` |
| `END_OF_DAY_TIME` | `16:30` หรือเวลาสิ้นวันที่ต้องการ |
| `CLEANING_DATA_URL` | URL `/exec` ของ Apps Script เดิม |
| `CLEANING_APP_URL` | `https://po45-ops.github.io/cleaning-system/` |
| `SCHOOL_NAME` | `โรงเรียนไตรธารวิทยา` |
| `MESSENGER_COMMANDS_ENABLED` | `true` |
| `MESSENGER_COMMANDS_ADMIN_ONLY` | `true` เพื่อให้เฉพาะผู้ดูแลถามข้อมูลได้ |
| `SEND_DAILY_PDF_REPORT` | `true` เพื่อส่ง PDF หลังสรุปสิ้นวัน |
| `SEND_MONTHLY_PDF_REPORT` | `true` เพื่อส่ง PDF เดือนก่อนหน้าในวันทำการแรก |
| `CLEANING_REPORT_MAX_IMAGES` | `6` (เลือกได้ 1–10 ภาพต่อรายงาน) |

`META_WEBHOOK_VERIFY_TOKEN` จะถูกสร้างให้อัตโนมัติ ห้ามนำ `META_PAGE_ACCESS_TOKEN` ไปใส่ใน `App.tsx`, README, Issue, Pull Request หรือไฟล์สาธารณะใด ๆ

## 5. เพิ่มเส้นทาง Webhook เพื่อรับ PSID

PSID คือรหัสผู้รับเฉพาะของ Page ระบบจะเก็บ PSID ที่พบไว้เป็น “รออนุมัติ” ก่อน จึงไม่มีผู้ที่ทัก Page แล้วถูกสมัครรับแจ้งเตือนโดยอัตโนมัติ

เพิ่มบรรทัดต่อไปนี้ไว้บนสุดของ `doGet(e)` เดิม ก่อนโค้ดอ่านข้อมูล:

```javascript
const metaWebhookResponse = maybeHandleMetaWebhookGet(e);
if (metaWebhookResponse) return metaWebhookResponse;
```

เพิ่มบรรทัดต่อไปนี้ไว้บนสุดของ `doPost(e)` เดิม ก่อนโค้ดสร้าง/แก้ไข/ลบข้อมูล:

```javascript
const metaWebhookResponse = maybeHandleMetaWebhookPost(e);
if (metaWebhookResponse) return metaWebhookResponse;
```

ตัวอย่างโครงสร้างที่ถูกต้อง:

```javascript
function doGet(e) {
  const metaWebhookResponse = maybeHandleMetaWebhookGet(e);
  if (metaWebhookResponse) return metaWebhookResponse;

  // โค้ด doGet เดิมทั้งหมดอยู่ต่อจากนี้
}

function doPost(e) {
  const metaWebhookResponse = maybeHandleMetaWebhookPost(e);
  if (metaWebhookResponse) return metaWebhookResponse;

  // โค้ด doPost เดิมทั้งหมดอยู่ต่อจากนี้
}
```

จากนั้น Deploy Google Apps Script เป็น Web App เวอร์ชันใหม่ โดยใช้ URL `/exec` เดิม

## 6. ตั้ง Webhook ใน Meta

1. เปิด Messenger settings ของ Meta App
2. เพิ่ม Callback URL เป็น URL `/exec` ของ Google Apps Script
3. ใส่ Verify Token ให้ตรงกับ `META_WEBHOOK_VERIFY_TOKEN` ใน Script Properties
4. Subscribe Page กับฟิลด์ `messages` และ `messaging_postbacks` หากมีให้เลือก
5. ใช้บัญชี Facebook ของผู้ดูแล เปิด Page แล้วส่งข้อความ `เริ่มแจ้งเตือน`
6. กลับไป Apps Script แล้วรัน `approvePendingMessengerRecipients`

ฟังก์ชันข้อ 6 จะเพิ่ม PSID ที่พบลงในทั้ง `MESSENGER_RECIPIENT_IDS` และ `MESSENGER_ADMIN_RECIPIENT_IDS` โดยไม่ต้องนำรหัสมาวางใน GitHub

## 7. ทดสอบก่อนเปิดใช้งาน

ทำตามลำดับนี้:

1. รัน `previewCleaningMessengerMessages` แล้วตรวจข้อความใน **Executions > Logs** — ขั้นตอนนี้ไม่ส่งจริง
2. ตรวจว่าได้ส่งข้อความหา Page จากบัญชีผู้รับแล้ว
3. รัน `sendCleaningMessengerConnectionTest`
4. ตรวจว่าได้รับข้อความ “เชื่อมต่อ Messenger สำเร็จ” ในแชทส่วนตัว
5. เปลี่ยน `MESSENGER_ENABLED` เป็น `true`
6. รัน `installCleaningMessengerTrigger`

การรัน `installCleaningMessengerTrigger` ซ้ำจะลบ Trigger ของโมดูลนี้แล้วสร้างใหม่เพียงหนึ่งรายการ จึงไม่เกิด Trigger ซ้ำ

## 8. เปิดผู้ช่วยแชทและรายงาน PDF

เมื่อ PSID ได้รับอนุมัติแล้ว ผู้ดูแลสามารถส่งข้อความหา Page ได้โดยตรง ระบบรองรับทั้งคำสั่งสั้นและประโยคธรรมชาติที่มีความหมายใกล้เคียงกัน

| พิมพ์ใน Messenger | คำตอบที่ได้รับ |
| --- | --- |
| `สรุปวันนี้` | จำนวนตรวจแล้ว เขตที่ยังไม่รายงาน และผู้รับผิดชอบ |
| `สถานการณ์วันนี้` หรือ `มีปัญหาอะไรวันนี้` | สถานการณ์ล่าสุด เขตไม่ผ่าน และหมายเหตุสำคัญ |
| `เวรวันนี้` | ตารางผู้ตรวจของสัปดาห์ปัจจุบัน |
| `ตารางสัปดาห์หน้า` | ตารางผู้ตรวจของสัปดาห์ถัดไป |
| `ตารางเดือนนี้` | ตารางทุกสัปดาห์ของเดือน |
| `สรุปเดือนนี้` | สถิติภาพรวมของเดือนปัจจุบัน |
| `PDF วันนี้` | สร้าง PDF รายวันพร้อมภาพจากการตรวจ แล้วส่งกลับในแชท |
| `PDF เดือนนี้` | สร้าง PDF สรุปรายเดือน แล้วส่งกลับในแชท |
| `เมนู` | แสดงรายการคำสั่งทั้งหมด |

รายงาน PDF ใช้เวลาประมาณ 1–2 นาที เพราะระบบสร้างเอกสารในงานเบื้องหลัง ไฟล์ทุกฉบับจะถูกเก็บในโฟลเดอร์ **Cleaning System Reports** ใน Google Drive ของบัญชีที่ Deploy เว็บแอป

ก่อนใช้งานครั้งแรก ให้ทำตามนี้:

1. รัน `initializeCleaningMessengerConfig`
2. รัน `createDailyCleaningPdfNow` จาก Apps Script Editor หนึ่งครั้ง
3. กดยอมรับสิทธิ์ Google Docs, Google Drive และการเรียก URL ตามที่ Google แสดง
4. เลือก **การทำให้ใช้งานได้ > จัดการการทำให้ใช้งานได้ > แก้ไข**
5. เลือก **เวอร์ชันใหม่** แล้วกด **การทำให้ใช้งานได้** โดยคง URL `/exec` เดิมไว้
6. ทดสอบใน Messenger ด้วย `สถานการณ์วันนี้` และ `PDF วันนี้`

หาก Meta แนบไฟล์ไม่สำเร็จ ระบบจะส่งลิงก์ไฟล์ใน Google Drive เป็นทางสำรอง ผู้รับต้องลงชื่อเข้าใช้บัญชีที่มีสิทธิ์เปิดไฟล์นั้น

## 9. เปิดแจ้งทันทีหลังบันทึก (แนะนำ)

Trigger ทุก 5 นาทีรองรับครบ 9/9 และเขตไม่ผ่านอยู่แล้ว หากต้องการให้เร็วขึ้น ให้เพิ่มหลังคำสั่งบันทึก Google Sheets สำเร็จใน `doPost` เดิม:

```javascript
SpreadsheetApp.flush();
notifyCleaningDataChanged();
```

ถ้ายังไม่แน่ใจตำแหน่ง ให้ใช้ Trigger ทุก 5 นาทีไปก่อน อย่าเพิ่มบรรทัดนี้ไว้ก่อนที่ข้อมูลจะถูกเขียนลง Sheet

## 10. ทดสอบสถานการณ์จริง

- ก่อน 09:00: ไม่ควรมีข้อความเตือนเวลา
- หลัง 09:00 และไม่ครบ: เตือนครั้งที่ 1 เพียงครั้งเดียว
- หลัง 12:00: แสดงรายชื่อเขตที่ขาด
- บันทึกคะแนน 0: แจ้งผู้ดูแลเพียงครั้งเดียวต่อรายการ
- บันทึกครบ 9 เขต: แจ้งครบ 9/9 แม้จะมีบางเขตคะแนน 0; การ “ตรวจครบ” ไม่ได้แปลว่า “ผ่านทุกเขต”
- เวลา 16:30: ส่งสรุปสิ้นวันหนึ่งครั้ง
- เสาร์–อาทิตย์: ไม่ส่งข้อความตามเวลา

หากต้องการทดสอบวันเดิมซ้ำ ให้รัน `resetCleaningMessengerNotificationState` แต่ต้องระวังว่ารอบถัดไปอาจส่งข้อความของวันนั้นซ้ำ

## ข้อจำกัดของ Messenger ที่ต้องทราบ

Messenger มาตรฐานอนุญาตให้ Page ส่งหาผู้ใช้ที่เริ่มบทสนทนาและยังอยู่ในกรอบเวลาที่ Meta อนุญาต โดยทั่วไปคือ 24 ชั่วโมง การเลือก `UPDATE` ไม่ได้เป็นการข้ามข้อจำกัดนี้

[Marketing Messages](https://developers.facebook.com/docs/messenger-platform/marketing-messages/) ส่งนอกกรอบมาตรฐานได้เมื่อผู้ใช้กดยินยอม แต่จำกัดหนึ่งข้อความต่อวันต่อ notification token จึงใช้แทนกฎ 09:00, 12:00 และ 15:00 ทั้งหมดพร้อมกันไม่ได้ ห้ามใช้ Message Tag ที่ไม่ตรงวัตถุประสงค์เพื่อหลบข้อจำกัด เพราะอาจทำให้ Page หรือ App ถูกจำกัดสิทธิ์

หาก Meta ตอบข้อผิดพลาดเรื่อง messaging window ให้ผู้รับส่งข้อความหา Page อีกครั้ง แล้วทดสอบใหม่ สำหรับงานภายในที่จำเป็นต้องแจ้งหลายครั้งทุกวันโดยไม่มีการโต้ตอบ LINE Official Account หรือ Telegram Bot จะเหมาะกว่า

## การดูแลความปลอดภัย

- Token และ PSID ต้องอยู่ใน Script Properties เท่านั้น
- หากสงสัยว่า Token รั่ว ให้ยกเลิกและสร้างใหม่ทันที
- ตรวจประวัติการทำงานที่ Apps Script > Executions
- รัน `uninstallCleaningMessengerTrigger` เมื่อต้องการหยุด Trigger
- ตั้ง `MESSENGER_ENABLED=false` เพื่อหยุดส่งทันทีโดยไม่ลบการตั้งค่า
