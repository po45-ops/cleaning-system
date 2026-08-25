# cleaning-system

ระบบบันทึก อนุมัติ ติดตาม และออกรายงานการตรวจเวรทำความสะอาดของโรงเรียนไตรธารวิทยา

- เว็บไซต์: <https://po45-ops.github.io/cleaning-system/>
- Frontend: React + TypeScript บน GitHub Pages
- ฐานข้อมูล: Google Sheets ผ่าน Google Apps Script
- พื้นที่ตรวจ: 9 เขต (ป.1–ป.6 และ ม.1–ม.3)

## การแจ้งเตือน Facebook Messenger

โมดูล [`apps-script/MessengerNotifications.gs`](apps-script/MessengerNotifications.gs) รองรับ:

- เตือนเมื่อยังตรวจไม่ครบเวลา 09:00, 12:00 และ 15:00 น.
- แจ้งเมื่อครบ 9/9 เขต
- แจ้งผู้ดูแลเมื่อมีคะแนน 0 (ไม่ผ่าน)
- ส่งสรุปสิ้นวัน พร้อมป้องกันข้อความซ้ำ
- รับคำสั่ง `PDF วันนี้`, `PDF สัปดาห์นี้`, `PDF สัปดาห์หน้า` และ `PDF เดือนนี้`
- รายงานรายวัน/รายสัปดาห์มีตารางสรุป ผู้รับผิดชอบ และภาพหลักฐานแบบ 3 รูปต่อรายการ
- เก็บ Page Token และ PSID ใน Google Apps Script Properties ไม่เปิดเผยในโค้ด

อ่านขั้นตอนสร้าง Facebook Page, Meta App, Webhook และ Trigger ที่ [คู่มือตั้งค่า Messenger ภาษาไทย](docs/facebook-messenger-setup-th.md)

> Messenger API ส่งจาก Facebook Page ไปยังผู้ที่เริ่มบทสนทนากับ Page เท่านั้น และยังอยู่ภายใต้นโยบาย messaging window ของ Meta

## คำสั่งพัฒนา

```bash
npm install
npm start
```

สร้างไฟล์ production:

```bash
npm run build
```
