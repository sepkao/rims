# Customer System

เอกสารนี้อ้างอิง `docs/rims_scope_lock_v2.md` และ `docs/rims_user_stories.md` เป็นหลัก

## ขอบเขต

Customer เป็นเว็บ anonymous สำหรับลูกค้าที่สแกน QR ของโต๊ะเท่านั้น ไม่มีการ login และไม่มีสิทธิ์เริ่มหรือยืดเวลาบุฟเฟต์เอง. Cashier เปิดโต๊ะ, สร้าง QR และเริ่ม `started_at`/`expires_at` ตั้งแต่ check-in.

## หน้าจอ

| หน้า | หน้าที่ |
|---|---|
| `Landing.tsx` | อ่าน token จาก `?qr=...`, ตรวจ session จริง, เก็บ token ใน `sessionStorage`, ปฏิเสธ QR ปิด/หมดอายุ |
| `Menu.tsx` | เมนู active, search, แสดง BOM ที่ถอดได้, จำนวนที่สั่งได้จากตู้พักละลาย, ตะกร้า และ timer |
| `OrderBuilder.tsx` | เลือกจำนวนไม่เกิน stock และถอดได้เฉพาะ ingredient `removable` |
| `OrderHistory.tsx` | ส่งตะกร้า, ดูสถานะออเดอร์ของ QR นี้, แสดง pending/กำลังทำ/เสิร์ฟ/ยกเลิก |
| `GracePeriodCountdown.tsx` | poll สถานะออเดอร์จริง, ยกเลิกได้ก่อน `confirm_at` |
| `QrExpiryBanner.tsx` | เตือนเมื่อเหลือไม่เกิน 5 นาทีหรือหมดอายุ |
| `CallStaffButton.tsx` | เรียกพนักงาน พร้อม client/server cooldown 30 วินาที |

รูปอาหารและหมวดไม่ถูกเดาจากชื่อหรือใช้ Unsplash mock เพราะ schema ปัจจุบันไม่มีสอง field นี้. UI แสดง placeholder ของชื่อเมนูจนกว่าจะเพิ่มข้อมูลจริงใน schema/API.

## Session และ QR

- URL รับ `?qr=<token>`.
- `GET /customer/session?qr_code=<token>` คืนเฉพาะ session ที่ยังเปิด; response บอก `status: active|expired`.
- ทุกคำขอที่แก้ข้อมูลส่ง `qrCode`; server หา session จาก QR และปฏิเสธ session ปิด/หมดอายุ.
- ไม่มี `table_session_id=1`, mock session หรือ endpoint เริ่มเวลา. `POST /customer/start-timer` ตอบ `410` เพื่อกัน client เก่า.
- ตะกร้าแยกตาม QR ใน `sessionStorage`; เปลี่ยน QR จะล้างตะกร้าเดิม.

## เมนูและสต็อก

`GET /customer/menu-items` ส่งเฉพาะ `menu_items.is_active = true` พร้อม BOM และ `availableServings`.

- คำนวณจาก lot ที่ยังไม่หมดอายุใน location `ตู้พักละลาย` เท่านั้น.
- Freezer ไม่นับเป็นของพร้อมขาย.
- เมนูไม่มี BOM มี `availableServings = 0` เพื่อไม่ให้สั่งของที่ระบบไม่สามารถตัดสต็อกได้.
- Client จำกัดจำนวนเพื่อ UX; server ตรวจซ้ำเสมอ จึงไม่เชื่อจำนวนจาก browser.

## Order flow

1. `POST /customer/orders` รับ `{ qrCode, items }`.
2. Server lock session, ตรวจ active menu, จำนวน 1–20, ingredient ที่ลูกค้าถอด, และ stock สดในตู้พักละลายภายใน transaction.
3. สร้าง order `pending` และ `confirm_at = now() + 60 seconds`; ยังไม่หัก stock.
4. ลูกค้ายกเลิกด้วย `POST /customer/orders/:id/cancel` ก่อนเวลาได้เฉพาะ order ของ QR เดียวกัน.
5. development worker ทุก 5 วินาที หรือ production pg_cron ทุก 1 นาที เรียก `auto_confirm_order()` สำหรับ pending ที่ครบเวลา. FIFO ใช้เฉพาะล็อตในตู้พักละลายที่ยังไม่หมดอายุ (`expiry_date > now()`) และเรียง expiry/created/id แบบคงที่. ถ้าสต็อกหายไปก่อน confirm, function ยกเลิกทั้งออเดอร์ ไม่ตัดบางรายการ.
6. ถ้ายืนยันสำเร็จ status เป็น `confirmed`; Customer แสดงเป็น `cooking`.

`0002_cashier_hardening.sql` override `auto_confirm_order()` ให้ FIFO deduction อยู่ใน PL/pgSQL subtransaction. หาก ingredient ใดไม่พอ การตัดทั้งหมดในรอบนั้น rollback ก่อนบันทึก `cancelled`.

## Customer API

| Method | Endpoint | หน้าที่ |
|---|---|---|
| GET | `/customer/session?qr_code=` | ตรวจ QR และอ่านโต๊ะ/เวลา |
| GET | `/customer/menu-items?qr_code=` | menu active + BOM + available servings |
| GET | `/customer/orders?qr_code=` | order history ของ QR |
| POST | `/customer/orders` | สร้าง pending order |
| POST | `/customer/orders/:id/cancel` | ยกเลิก pending order ของ QR |
| POST | `/customer/call-staff` | สร้าง cashier notification; จำกัด 30 วินาที/โต๊ะ |

API dev (`/dev/*`) ใช้ได้เฉพาะ `NODE_ENV !== production`; ทุก endpoint รับ QR จริง ไม่มี default session.

## ติดตั้งและตรวจสอบ

1. Apply `supabase/migrations/0001_init.sql` แล้ว `0002_cashier_hardening.sql`.
2. Cashier ต้อง set `VITE_CUSTOMER_APP_URL` ให้เป็น URL customer app ก่อนเปิดโต๊ะ.
3. Customer set `VITE_API_URL` เมื่อ API อยู่คนละ origin; local dev ที่ไม่ตั้งใช้ `http://localhost:3000`, production ที่ไม่ตั้งใช้ same-origin path.
4. ตรวจ build ด้วย `tsc --noEmit -p apps/customer/tsconfig.json` และ `vite build`.
5. UAT: cashier check-in, scan QR, สั่ง menu ที่มี stock, cancel ภายใน 60 วินาที, ปล่อย confirm, ลอง QR หมดอายุ และเรียกพนักงานซ้ำภายใน 30 วินาที.
