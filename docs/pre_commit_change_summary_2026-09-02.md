# Pre-commit Change Summary — 2026-09-02

เอกสารนี้สรุปความแตกต่างของ working tree เทียบกับ `HEAD` ก่อน commit หรือ push

> **Current snapshot (ตรวจเมื่อ 2026-09-02 23:37:34 +07:00)**
>
> ส่วนนี้เป็นสถานะล่าสุดและให้ถือว่า supersede ข้อมูล snapshot เดิมด้านล่าง ซึ่งมาจากรอบ UI ก่อนหน้า

## สถานะ Git ล่าสุด

- Branch: `codex/cashier-p0`
- `HEAD`: `0cadef2` — `Merge branch 'nopnop' into main`
- เทียบกับ `HEAD`: tracked files modified 24 ไฟล์ และ untracked files 9 ไฟล์ (ก่อนเพิ่มเอกสารนี้)
- ชุด Cashier/Staff ถูก commit และ push ไปที่ `origin/nopnop` แล้วใน commit `c41c78f`; snapshot นี้บันทึกไฟล์ Customer UI ที่ตามมาเพื่อรวมใน commit ต่อเนื่อง
- working tree มีทั้งงานจากรอบ Cashier/Customer/Staff และการแก้ UI ที่มีอยู่ก่อนแล้ว จึงไม่ควรเหมารวมว่าเป็นการแก้จากผู้ทำงานคนเดียว

## สรุปการเปลี่ยนแปลงใน working tree ปัจจุบัน

### API และ runtime (`apps/api`)

- `src/index.ts`: เพิ่ม CORS สำหรับ LAN ผ่าน `CORS_ALLOWED_ORIGINS`, เพิ่ม role guard ของ Staff, เพิ่ม `GET /staff/orders` และ `PUT /staff/orders/:id/serve` สำหรับ Kitchen Queue, และจำกัด development worker ไม่ให้ทำงานใน production
- `src/db.ts`: โหลด `.env` จากตำแหน่งของ package และรองรับการรันจาก workspace
- `package.json`: เพิ่ม scripts สำหรับตรวจ/รัน Cashier P0 และ HTTP smoke test
- `.env.example`: เพิ่มตัวอย่าง `DATABASE_URL`, `SESSION_SECRET`, `CORS_ALLOWED_ORIGINS`
- `scripts/cashier-p0.mjs`: ตรวจและ apply migration พร้อมตรวจ constraints, functions และ pg_cron jobs
- `scripts/cashier-p0-smoke.mjs`: สร้างข้อมูลทดสอบชั่วคราว ตรวจ login/check-in/QR/order/Kitchen แล้วล้างข้อมูล

### Database และ scheduler (`supabase/migrations`)

- `0002_cashier_hardening.sql`: ทำ cashier tables/constraints ให้ idempotent และทำ `auto_confirm_order()` ให้ atomic
- `0003_cashier_expiry_schedule.sql`: เปิด `pg_cron` พร้อม jobs หมดอายุ table session และ auto-confirm order ทุก 1 นาที
- `0005_cashier_stock_deduction_signature.sql`: เพิ่ม/แก้ฟังก์ชัน FIFO deduction แบบ 4 arguments ให้ตรงกับ `auto_confirm_order()` และรองรับ legacy `stock_movements` ที่ยังไม่มี `order_item_id`
- `0004_orders_acknowledged_at.sql`: เพิ่ม `orders.acknowledged_at` และ index สำหรับการ acknowledge ใน Kitchen (ไฟล์ untracked ที่พบใน working tree)

แก้ migration numbering แล้ว: เก็บ `0004_orders_acknowledged_at.sql` ของเพื่อนเป็นเลข `0004` และใช้ `0005_cashier_stock_deduction_signature.sql` สำหรับ FIFO signature เพื่อไม่ให้ migration filename ซ้ำกัน

### Customer app (`apps/customer`)

- `src/lib/CartContext.tsx` + `src/lib/cart-item-id.ts`: แก้การเพิ่มสินค้าในตะกร้าบน HTTP/LAN โดยมี UUID fallback เมื่อ `crypto.randomUUID()` ใช้ไม่ได้
- `src/lib/api.ts`, `.env.example`, `vite.config.ts`: ปรับ API URL และการรันบน LAN
- `src/App.tsx`, `src/pages/Landing.tsx`, `src/pages/Expired.tsx`: เพิ่ม route/หน้าสำหรับ QR หมดอายุและสถานะ session
- `src/pages/Menu.tsx`, `OrderBuilder.tsx`, `OrderHistory.tsx`, `GracePeriodCountdown.tsx`: เชื่อม flow เมนู/เพิ่มจำนวน/ตะกร้า/ยืนยัน/ยกเลิก/ติดตามสถานะ และปรับ UI
- `src/components/BuffetTimer.tsx`, `CallStaffButton.tsx`, `QrExpiryBanner.tsx`, `index.css`, `index.html`: ปรับ timer, เรียกพนักงาน, banner QR และ visual styling

### Internal app (`apps/internal`)

- `src/pages/staff/OrdersToServe.tsx`: จาก placeholder เป็น Kitchen Queue จริง ดึงคิวทุก 3 วินาที ค้นหา/รีเฟรช และกด “เสิร์ฟแล้ว” ได้
- `src/pages/cashier/CheckIn.tsx`, `.env.example`, `vite.config.ts`: รองรับ URL customer app และ LAN configuration

### Documentation ที่แก้

- `docs/cashier_system.md`: เพิ่มขั้นตอน Cashier P0, scheduler และ smoke test
- `docs/customer_system.md`: ระบุ auto-confirm worker/pg_cron และสถานะ customer flow
- ไฟล์นี้: บันทึก snapshot พร้อมวันเวลาและรายการไฟล์ก่อน commit

## ผลตรวจสอบล่าสุด

- `npm run cashier:p0:check`: ผ่าน — core schema, cashier tables, constraints, FIFO signature และ cron jobs เป็น `true`
- `npm test --workspace api -- --runInBand`: ผ่าน 15/15
- `npm run build --workspace customer`: ผ่าน
- `npm run build --workspace internal`: ผ่าน
- Live DB: ออเดอร์ #6/#7 เป็น `confirmed`, `served_at` ยังว่าง และมี deduction movement แล้ว
- `git diff --check`: ยังไม่ผ่าน เนื่องจาก trailing whitespace ใน `apps/api/src/db.ts` และไฟล์ Customer UI หลายไฟล์ (ส่วนใหญ่เป็นบรรทัดที่เพิ่มใน working tree)

## สิ่งที่ยังต้องทำก่อน commit/push

1. ตรวจ `git diff`/`git status` อีกครั้งหลังรวมไฟล์ Customer UI ชุดล่าสุด
2. Restart API/Internal dev server ก่อนทดสอบ Customer ordering และ Kitchen Queue ใน browser

## Historical snapshot จากรอบก่อนหน้า (ไม่ใช่สถานะปัจจุบัน)

- Branch: `nopnop`
- Upstream: `origin/nopnop`
- Base commit: `7a092f2` — `feat: improve inventory intake, stock filtering, and lot expiry handling 3.`
- สถานะขณะตรวจ: การเปลี่ยนแปลงทั้งหมดยังไม่ถูก stage
- ขนาด diff ก่อนเพิ่มเอกสารนี้: 11 ไฟล์ที่มี content diff, `+1,363 / -130`
- `apps/customer/src/App.tsx` ถูก Git รายงานว่า modified เพิ่มอีก 1 ไฟล์ แต่ blob ใน index และ working tree ตรงกัน และไม่มี content diff; มีแนวโน้มเป็น stat/line-ending change

## ภาพรวม

การเปลี่ยนแปลงรอบนี้เน้น redesign และเพิ่ม motion/interaction ให้ Internal UI โดยเฉพาะ Staff dashboard, หน้ารับวัตถุดิบ และ sidebar พร้อมเปลี่ยนฟอนต์ทั้ง Customer/Internal เป็น Anuphan

ไม่มีการแก้ API, database schema, migration, authentication, routing definition หรือ business transaction ใน working tree รอบนี้ และยังไม่ได้เพิ่มระบบ QR แบบจำกัดเวลา

## รายการเปลี่ยนแปลง

### Customer application

- `apps/customer/src/index.css`
  - import Google Font `Anuphan`
  - เปลี่ยนฟอนต์หลักจาก `Inter` เป็น `Anuphan`
- `apps/customer/src/App.tsx`
  - Git แสดงสถานะ modified แต่ไม่พบ content diff จาก `HEAD`

### Internal application shell

- `apps/internal/src/App.tsx`
  - ใช้ `useLocation()` และ key จาก pathname เพื่อเริ่ม page transition ใหม่เมื่อเปลี่ยนหน้า
  - ครอบ `<Outlet />` ด้วย `.page-animate`
- `apps/internal/src/components/sidebar.tsx`
  - redesign sidebar เป็น brand header, user identity card และ footer logout
  - เพิ่ม avatar initials และ role badge แยกสี Owner/Staff/Cashier
  - ปรับ active navigation ให้มี icon background และ status pip
  - คงรายการเมนูและ logout behavior เดิม
- `apps/internal/src/index.css`
  - import และตั้งฟอนต์ `Anuphan`
  - ขยาย sidebar จาก 248px เป็น 260px และปรับพื้นที่ content ตาม
  - เพิ่ม style สำหรับ brand, avatar, role badge, navigation state และ logout
  - เพิ่ม hover/active interaction ให้ admin cards และ controls
  - เพิ่ม page transition และ animation utilities: `anim-down`, `anim-up`, `anim-right`, `anim-fade`, `count-anim`, `d-1` ถึง `d-5`
  - ปรับ responsive sidebar สำหรับหน้าจอเล็ก

### Owner UI

- `apps/internal/src/pages/owner/PortionPresetsTab.tsx`
  - เปลี่ยน emoji ของ stat cards เนื้อสัตว์และผักเป็นสัญลักษณ์ `✦` เพื่อให้ visual language สม่ำเสมอ

### Staff UI

- `apps/internal/src/pages/staff/StaffDashboard.tsx`
  - redesign dashboard ครั้งใหญ่ โดยยังใช้ข้อมูล `batches` และ `fifoQueue` จาก InventoryContext เดิม
  - เพิ่ม greeting ตามเวลาของเครื่องผู้ใช้
  - แสดงสถานะล็อตพร้อมใช้, FIFO, ใกล้หมดอายุ และหมดอายุด้วยสีที่แยกชัดขึ้น
  - ปรับ FIFO pick list พร้อม empty state และสถานะของแต่ละล็อต
  - เพิ่ม stock mix, operational checklist และ quick actions ไปหน้ารับของ/โอนย้าย/Freezer/Prep
  - แยก UI เป็น `StatCard`, `TodoItem` และ `QuickAction`
- `apps/internal/src/pages/staff/ReceiveLot.tsx`
  - redesign หน้าและ feedback states ของการรับวัตถุดิบเข้า LOT
  - เพิ่ม custom ingredient combobox ที่ค้นหา/กรองชื่อ, highlight คำค้น, เลือกด้วยคีย์บอร์ด และปิดเมื่อคลิกภายนอก
  - เพิ่ม styled date picker พร้อมรูปแบบวันที่ภาษาไทย
  - เพิ่ม auto-scroll ในรายการ staging เมื่อเพิ่มวัตถุดิบ
  - ปรับ success/error state, loading/submitting state, empty state และปุ่มลบ/ยืนยัน
  - business flow เดิมยังคงเรียก ingredients API และ inventory lot submission ตามเดิม
- `apps/internal/src/pages/staff/KitchenStock.tsx`
  - เพิ่ม staggered entrance animations ให้ header, stats, error, priority card และ stock table
- `apps/internal/src/pages/staff/OrdersToServe.tsx`
  - เพิ่ม entrance animations เท่านั้น
  - หน้ายังเป็น placeholder ที่รอ orders API/metrics
- `apps/internal/src/pages/staff/ServingQueue.tsx`
  - เพิ่ม entrance animations เท่านั้น
  - หน้ายังเป็น placeholder ที่รอ orders API
- `apps/internal/src/pages/staff/TransferToThawPrep.tsx`
  - เพิ่ม animations ให้ header/form
  - เอา emoji ออกจากป้าย `FREEZER` และ `PREP FRIDGE`
  - ไม่เปลี่ยน transaction หรือ FIFO transfer logic

## สิ่งที่ไม่ได้เปลี่ยน

- ไม่มีไฟล์ใน `apps/api` ถูกแก้
- ไม่มี Supabase migration หรือ schema ถูกแก้
- ไม่มี route ใหม่
- ไม่มีการเชื่อม Kitchen Queue หรือ Serving Queue เข้ากับ orders API เพิ่มเติม
- ไม่มีระบบ QR/table session แบบจำกัดเวลา
- ไม่มี dependency ใหม่หรือ lockfile change

## ผลตรวจสอบก่อน commit

| Check | ผลลัพธ์ | รายละเอียด |
|---|---|---|
| Internal build | ไม่ผ่าน | TypeScript `TS6133` ที่ `StaffDashboard.tsx:362`: รับ parameter `icon` แต่ไม่ได้ใช้งาน |
| Internal lint | ผ่านพร้อม 4 warnings | warning ใหม่จาก `StaffDashboard.tsx` เรื่อง `icon`; warning เดิมเกี่ยวกับ Fast Refresh และ hook dependency ยังอยู่ |
| Customer build | ผ่าน | Vite production build สำเร็จ |
| Customer lint | ผ่านพร้อม 2 warnings | unused catch parameter และ Fast Refresh warning |
| `git diff --check` | ไม่ผ่าน | พบ trailing whitespace ใน `App.tsx`, `index.css` และ `ReceiveLot.tsx` |

## ความเสี่ยง/สิ่งที่ควรทำก่อน commit

1. แก้ Internal build error โดยใช้ `icon` ใน `StatCard` หรือเอา parameter/prop นี้ออก
2. ลบ trailing whitespace ที่ `git diff --check` รายงาน
3. ตรวจ `apps/customer/src/App.tsx` และ normalize line ending เพื่อไม่ให้มี modified state ที่ไม่มี content diff
4. ทดสอบ visual และ responsive behavior ของ sidebar, dashboard และ Receive Lot ใน browser
5. ตรวจว่าการ import Google Font จากภายนอกเป็นสิ่งที่ต้องการใน production; หากระบบต้องทำงาน offline ควร self-host font

## Suggested commit scope

หากรวมเป็น commit เดียว:

```text
feat(ui): refresh staff dashboard, receive-lot flow, and navigation
```

หากต้องการ history ที่อ่านง่ายกว่า แนะนำแยกเป็น:

1. `style(ui): add Anuphan font, page transitions, and sidebar redesign`
2. `feat(staff): improve dashboard and receive-lot user experience`
3. `style(staff): add entrance animations across operational pages`
