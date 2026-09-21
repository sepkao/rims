# RIMS — Database Schema & ER Diagram

ฐานข้อมูล PostgreSQL (Supabase) ของระบบ RIMS — สรุปจากไฟล์ migration จริงทั้ง 24 ไฟล์
ใน `supabase/migrations/` (สถานะ ณ commit ล่าสุดบน `main`)

**หมายเหตุสำคัญ**: ไฟล์นี้เป็นเอกสารสรุปสถานะ *ปัจจุบัน* หลัง apply migration ครบทุกไฟล์
ไม่ใช่ไฟล์ที่ใช้สร้างฐานข้อมูล — ถ้าจะแก้ schema ต้องเขียน migration ใหม่เสมอ

---

## 1. ภาพรวม

ระบบแบ่งเป็น 5 กลุ่มหลัก:

| กลุ่ม | ตาราง | หน้าที่ |
|---|---|---|
| **ผู้ใช้** | `users` | บัญชี Owner / Staff / Cashier (Owner สร้างให้ ไม่มีสมัครเอง) |
| **คลังวัตถุดิบ** | `ingredients`, `storage_locations`, `lot_headers`, `stock_lots`, `stock_movements`, `waste_records` | รับของเข้า, ล็อต FIFO, ย้ายของ, audit trail, ของเสีย |
| **เมนู** | `menu_items`, `menu_categories`, `menu_item_ingredients` | เมนูบุฟเฟต์ + สูตร (BOM) |
| **โต๊ะ & ออเดอร์** | `dining_tables`, `table_sessions`, `orders`, `order_items`, `order_item_bom`, `order_item_customizations`, `order_item_serving_events` | เช็คอินโต๊ะ, QR, สั่งอาหาร, เสิร์ฟ, คืนของ |
| **แคชเชียร์ & ระบบ** | `cashier_payments`, `cashier_notifications`, `settings`, `system_logs`, `schema_migrations` | ชำระเงิน, แจ้งเตือนเวลา, ค่าตั้งค่า, log |

**หลักการสำคัญที่ฝังอยู่ใน schema:**

- **ร้านเป็นบุฟเฟต์ล้วน** — `menu_items` ไม่มีคอลัมน์ `price` เลย รายได้คิดจากจำนวนหัว × ราคาต่อหัว ที่ snapshot ไว้ใน `table_sessions`
- **2 สถานที่เก็บเท่านั้น** — `Freezer` (หน่วย kg, เนื้อเท่านั้น) และ `ตู้พักละลาย` (หน่วย plate, รับทั้งเนื้อและผัก)
- **FIFO จริง** — ตัดสต็อกจากล็อตที่หมดอายุก่อนเสมอ และตัดข้ามหลายล็อตได้ (`deduct_stock_fifo`)
- **ตัดสต็อกจุดเดียว** — ตัดตอน auto-confirm (60 วินาทีหลังสั่ง) ไม่ใช่ตอนกดสั่ง
- **ไม่มี AI/LLM** — ทุกการคำนวณเป็น SQL + เลขคณิตล้วน (`ai_reason` เป็นข้อความ template, `ai_confidence` เป็น NULL เสมอ)

---

## 2. ER Diagram

```mermaid
erDiagram
    users ||--o{ users : "created_by"
    users ||--o{ lot_headers : "received_by"
    users ||--o{ table_sessions : "opened_by / ended_by"
    users ||--o{ orders : "acknowledged_by"
    users ||--o{ order_items : "last_served_by"
    users ||--o{ order_item_serving_events : "served_by"
    users ||--o{ stock_movements : "actor_id"
    users ||--o{ waste_records : "reviewed_by"
    users ||--o{ cashier_payments : "cashier_id"
    users ||--o{ system_logs : "actor_id"

    ingredients ||--o{ stock_lots : "มีล็อต"
    ingredients ||--o{ menu_item_ingredients : "อยู่ในสูตร"
    ingredients ||--o{ order_item_bom : "สูตรที่ freeze แล้ว"
    ingredients ||--o{ order_item_customizations : "ถูกตัดออก"

    storage_locations ||--o{ stock_lots : "เก็บที่"
    lot_headers ||--o{ stock_lots : "รอบรับของ"
    stock_lots ||--o{ stock_lots : "source_lot_id (แตกล็อตย่อย)"
    stock_lots ||--o{ stock_movements : "audit trail"
    stock_lots ||--o{ waste_records : "ของเสีย"

    menu_items ||--o{ menu_item_ingredients : "BOM"
    menu_items ||--o{ order_items : "ถูกสั่ง"

    dining_tables ||--o{ table_sessions : "รอบการใช้โต๊ะ"
    table_sessions ||--o{ orders : "ออเดอร์ในรอบ"
    table_sessions ||--o| cashier_payments : "ชำระเงิน 1:1"
    table_sessions ||--o{ cashier_notifications : "แจ้งเตือนเวลา"

    orders ||--o{ order_items : "รายการในออเดอร์"
    orders ||--o{ stock_movements : "การตัดสต็อก"

    order_items ||--o{ order_item_bom : "สูตร ณ เวลาสั่ง"
    order_items ||--o{ order_item_customizations : "ตัดวัตถุดิบออก"
    order_items ||--o{ order_item_serving_events : "ประวัติการเสิร์ฟ"
    order_items ||--o{ stock_movements : "ตัด/คืนของรายจาน"

    users {
        bigserial id PK
        text name
        text email UK
        text password_hash
        text role "owner|staff|cashier"
        bigint created_by FK
        boolean is_active
        timestamptz created_at
    }

    ingredients {
        bigserial id PK
        text name UK
        text category "meat|vegetable"
        decimal default_portion_size_kg
        decimal reorder_threshold_kg "NULL สำหรับผัก"
        int thaw_prep_threshold_plates
        int freezer_expiry_warning_days
        decimal buffer_percentage
        decimal supplier_pack_size_kg
        boolean is_active
        timestamptz created_at
    }

    storage_locations {
        bigserial id PK
        text name UK "Freezer | ตู้พักละลาย"
        text unit_type "kg|plate"
        text accepts_category "meat|vegetable|both"
    }

    lot_headers {
        bigserial id PK
        timestamptz received_at
        bigint received_by FK
        text supplier_reference
    }

    stock_lots {
        bigserial id PK
        bigint lot_header_id FK
        bigint ingredient_id FK
        bigint storage_location_id FK
        decimal quantity_original
        decimal quantity_remaining
        decimal unit_cost
        timestamptz expiry_date
        bigint source_lot_id FK
        boolean is_not_fresh
        timestamptz created_at
    }

    stock_movements {
        bigserial id PK
        bigint stock_lot_id FK
        text movement_type "intake|adjustment|deduction|return"
        decimal quantity "+เข้า / -ออก"
        bigint actor_id FK "NULL = ระบบทำเอง"
        bigint order_id FK
        bigint order_item_id FK
        timestamptz created_at
    }

    waste_records {
        bigserial id PK
        bigint stock_lot_id FK
        decimal quantity
        decimal unit_cost_snapshot
        decimal waste_cost
        text ai_reason "ข้อความ template ไม่ใช่ AI"
        decimal ai_confidence "NULL เสมอ"
        text status "pending_review|confirmed|rejected"
        bigint reviewed_by FK
        timestamptz created_at
    }

    menu_items {
        bigserial id PK
        text name
        text description
        text category
        text image_path
        text image_alt
        int sort_order
        boolean is_active "ลูกค้ามองเห็นไหม"
        boolean is_deleted "soft delete"
        timestamptz created_at
    }

    menu_categories {
        bigserial id PK
        text name UK
        int sort_order
        timestamptz created_at
    }

    menu_item_ingredients {
        bigserial id PK
        bigint menu_item_id FK
        bigint ingredient_id FK
        int quantity_required_plates
        boolean removable "ลูกค้าตัดออกได้ไหม"
    }

    dining_tables {
        bigserial id PK
        text table_number UK
        text status "empty|occupied|near_expiry|expired|pending_cleanup"
        boolean is_hidden
        boolean is_deleted
    }

    table_sessions {
        bigserial id PK
        bigint dining_table_id FK
        text qr_code
        bigint opened_by FK
        timestamptz started_at
        timestamptz expires_at
        timestamptz ended_at
        bigint ended_by FK
        int adult_count
        int child_count
        int senior_count
        int disabled_count
        decimal price_per_adult "snapshot ตอนเช็คอิน"
        decimal price_per_child
        decimal price_per_senior
        decimal price_per_disabled
    }

    orders {
        bigserial id PK
        bigint table_session_id FK
        text status "pending|confirmed|cancelled"
        timestamptz created_at
        timestamptz confirm_at "created_at + 60 วินาที"
        timestamptz confirmed_at
        timestamptz cancelled_at
        timestamptz served_at
        timestamptz acknowledged_at
        bigint acknowledged_by FK
    }

    order_items {
        bigserial id PK
        bigint order_id FK
        bigint menu_item_id FK
        int quantity
        int quantity_returned
        int served_quantity
        timestamptz last_served_at
        bigint last_served_by FK
    }

    order_item_bom {
        bigint order_item_id PK_FK
        bigint ingredient_id PK_FK
        int quantity_required_plates
        boolean removable
    }

    order_item_customizations {
        bigserial id PK
        bigint order_item_id FK
        bigint ingredient_id FK
    }

    order_item_serving_events {
        bigserial id PK
        bigint order_item_id FK
        int quantity
        bigint served_by FK
        bigint acknowledged_by FK
        boolean is_delegate
        text request_id UK "กันกดซ้ำ"
        timestamptz created_at
    }

    cashier_payments {
        bigserial id PK
        text receipt_number UK
        bigint table_session_id FK_UK
        bigint cashier_id FK
        text payment_method "cash|promptpay"
        decimal subtotal
        decimal cash_received
        decimal change_amount
        text payment_reference
        text payment_status
        timestamptz created_at
    }

    cashier_notifications {
        bigserial id PK
        bigint table_session_id FK
        text table_number
        text message
        text notification_type "30_min|5_min|expired"
        boolean is_read
        timestamptz created_at
    }

    settings {
        text key PK
        text value
        timestamptz updated_at
    }

    system_logs {
        bigserial id PK
        bigint actor_id FK
        text action
        jsonb details
        timestamptz created_at
    }
```

---

## 3. รายละเอียดแต่ละตาราง

### 3.1 `users` — บัญชีผู้ใช้
| คอลัมน์ | ชนิด | รายละเอียด |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `name` | TEXT NOT NULL | |
| `email` | TEXT UNIQUE NOT NULL | ใช้ login |
| `password_hash` | TEXT NOT NULL | bcrypt |
| `role` | TEXT NOT NULL | CHECK `owner` / `staff` / `cashier` |
| `created_by` | BIGINT FK→`users.id` | NULL = บัญชี Owner คนแรก (bootstrap) |
| `created_at` | TIMESTAMPTZ | |
| `is_active` | BOOLEAN DEFAULT true | ปิดการใช้งานแบบ soft (ลบจริงไม่ได้เพราะติด FK ประวัติ) |

> **Bootstrap**: สมัครเองได้เฉพาะตอนตาราง `users` ว่างเปล่า (บัญชีแรก = Owner) หลังจากนั้นปิดถาวร

### 3.2 `ingredients` — วัตถุดิบหลัก
| คอลัมน์ | ชนิด | รายละเอียด |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `name` | TEXT UNIQUE NOT NULL | ใช้กับ autocomplete |
| `category` | TEXT NOT NULL | CHECK `meat` / `vegetable` |
| `default_portion_size_kg` | DECIMAL(6,3) | เช่น 0.100 kg/ถาด สำหรับเนื้อ |
| `reorder_threshold_kg` | DECIMAL(10,3) NULL | เกณฑ์แจ้งเตือน Owner (Freezer, เนื้อเท่านั้น) |
| `thaw_prep_threshold_plates` | INT NULL | เกณฑ์แจ้งเตือนใน ตู้พักละลาย |
| `freezer_expiry_warning_days` | INT DEFAULT 3 | เตือนล่วงหน้ากี่วันก่อนหมดอายุ |
| `buffer_percentage` | DECIMAL(5,2) DEFAULT 15.00 | เผื่อในสูตรแนะนำดึงของ/สั่งซื้อ |
| `supplier_pack_size_kg` | DECIMAL(6,3) NULL | ปัดยอดสั่งซื้อขึ้นเป็นแพ็ค |
| `is_active` | BOOLEAN DEFAULT true | archive วัตถุดิบโดยไม่ลบประวัติ (0012) |

### 3.3 `storage_locations` — สถานที่เก็บ (seed ไว้ 2 แถวตายตัว)
| `name` | `unit_type` | `accepts_category` |
|---|---|---|
| `Freezer` | `kg` | `meat` |
| `ตู้พักละลาย` | `plate` | `both` |

### 3.4 `lot_headers` — หัวบิลรับของ 1 รอบ
`id`, `received_at`, `received_by` FK→`users`, `supplier_reference` TEXT (0018)
> 1 รอบรับของ = 1 header แต่มีหลายรายการย่อยใน `stock_lots` (atomic ทั้งรอบ)

### 3.5 `stock_lots` — ล็อตสินค้า (หัวใจของระบบ FIFO)
| คอลัมน์ | ชนิด | รายละเอียด |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `lot_header_id` | BIGINT FK→`lot_headers` | |
| `ingredient_id` | BIGINT FK→`ingredients` | |
| `storage_location_id` | BIGINT FK→`storage_locations` | **หน่วยของ quantity ขึ้นกับตรงนี้** |
| `quantity_original` | DECIMAL(12,3) ≥ 0 | |
| `quantity_remaining` | DECIMAL(12,3) ≥ 0 | |
| `unit_cost` | DECIMAL(12,2) | บาท/หน่วยของแถวนี้ (kg หรือ plate) |
| `expiry_date` | TIMESTAMPTZ NOT NULL | **ตัวเรียงลำดับ FIFO** |
| `source_lot_id` | BIGINT FK→`stock_lots` | ล็อตแม่ใน Freezer (เฉพาะเนื้อที่ย้ายมาตู้พักละลาย) |
| `is_not_fresh` | BOOLEAN DEFAULT false | ตั้งโดย `mark_not_fresh_lots()` เมื่อเลยวันหมดอายุ |

**การไหลของสินค้า:**
- **ผัก** → สร้างที่ `ตู้พักละลาย` ตรงๆ ตอนรับเข้า (`source_lot_id` = NULL)
- **เนื้อ** → สร้างที่ `Freezer` (kg) ก่อน → ตอนย้าย สร้างแถวใหม่ที่ `ตู้พักละลาย` (plate) โดยชี้ `source_lot_id` กลับไปหาแถวแม่

### 3.6 `stock_movements` — audit trail ทุกการเคลื่อนไหว
`movement_type` ∈ `intake` / `adjustment` / `deduction` / `return`
`quantity` เป็นบวกเมื่อเข้า, ลบเมื่อออก · `actor_id` NULL = ระบบทำเอง (auto-confirm)
เชื่อมกับ `order_id` และ `order_item_id` เพื่อรู้ว่าตัดของให้จานไหน (จำเป็นต่อการคืนของ)

### 3.7 `waste_records` — ของเสีย (เสนอโดยระบบ, Owner ตัดสิน)
`status` ∈ `pending_review` / `confirmed` / `rejected`
`unit_cost_snapshot` + `waste_cost` ถูก copy ไว้ตอนสร้าง เพื่อไม่ให้ต้นทุนเปลี่ยนย้อนหลัง
> `ai_reason` เป็นข้อความสำเร็จรูป และ `ai_confidence` เป็น NULL เสมอ — **ไม่มีการเรียก AI จริง**

### 3.8 `menu_items` + `menu_categories` + `menu_item_ingredients`
- `menu_items` — **ไม่มีคอลัมน์ราคา** (บุฟเฟต์ล้วน) มี `category`, `image_path`, `image_alt`, `sort_order`, `is_active` (ลูกค้ามองเห็น), `is_deleted` (soft delete)
- `menu_categories` — ตารางหมวดหมู่แยก (seed: เนื้อสัตว์ / ผัก / เซ็ตคอมโบ) เชื่อมกับ `menu_items.category` ด้วย**ชื่อ ไม่ใช่ FK** — ความถูกต้องถูกบังคับที่ชั้น API แทน: เปลี่ยนชื่อหมวดจะ `UPDATE menu_items.category` ตามให้ใน transaction เดียวกัน, ลบหมวดที่ยังมีเมนูอยู่จะถูกปฏิเสธ (409), และสร้าง/แก้เมนูด้วยหมวดที่ไม่มีอยู่จริงจะถูกปฏิเสธ (400)
- `menu_item_ingredients` — BOM ต้นฉบับ: เมนู 1 ชุดใช้วัตถุดิบอะไร กี่ถาด (`quantity_required_plates`) และ `removable` = ลูกค้าตัดออกได้ไหม

### 3.9 `dining_tables` & `table_sessions`
- `dining_tables` — สถานะปัจจุบันของโต๊ะเท่านั้น (`empty` / `occupied` / `near_expiry` / `expired` / `pending_cleanup`) + `is_hidden`, `is_deleted` (0014)
- `table_sessions` — **ประวัติทุกรอบการใช้โต๊ะ**
  - `qr_code` — token สุ่ม 24 bytes (base64url) ลูกค้าใช้เข้าหน้าสั่งอาหาร
  - `expires_at` = `started_at` + `settings.qr_duration_minutes`
  - จำนวนหัว 4 ประเภท + **ราคาต่อหัวที่ snapshot ไว้** — Owner เปลี่ยนราคาทีหลังไม่กระทบรอบที่จบไปแล้ว
  - **Unique partial index**: 1 โต๊ะมี session ที่ยังไม่จบได้แค่รอบเดียว

### 3.10 `orders` / `order_items` / `order_item_bom` / `order_item_customizations`
- `orders` — `confirm_at` = `created_at` + 60 วินาที (ช่วงยกเลิกได้) · `acknowledged_by` = staff ที่รับผิดชอบ
- `order_items` — `quantity`, `quantity_returned`, `served_quantity` พร้อม CHECK ว่า `served + returned ≤ quantity`
- `order_item_bom` — **สูตรที่ freeze ไว้ ณ เวลาสั่ง** (PK รวม `order_item_id` + `ingredient_id`) แก้เมนูทีหลังไม่กระทบออเดอร์เก่า
- `order_item_customizations` — วัตถุดิบที่ลูกค้าสั่งตัดออกจากจานนั้น

### 3.11 `order_item_serving_events` — ประวัติการเสิร์ฟรายครั้ง (0022)
รองรับเสิร์ฟทีละส่วน, เสิร์ฟแทนกัน (`is_delegate`), และมี `request_id UNIQUE` กันกดซ้ำ (idempotency)

### 3.12 `cashier_payments` & `cashier_notifications`
- `cashier_payments` — **1 session ชำระได้ครั้งเดียว** (`table_session_id` UNIQUE) · รับเฉพาะ `cash` / `promptpay` (0017 ตัด `card` ออก) · มี CHECK ว่าเงินสดต้องได้รับ ≥ ยอด และ promptpay ต้องมีเลขอ้างอิง
- `cashier_notifications` — แจ้งเตือนเวลาอัตโนมัติ `30_min` / `5_min` / `expired` (unique ต่อ session+type กันแจ้งซ้ำ)

### 3.13 `settings` — key/value
| key | ค่าเริ่มต้น |
|---|---|
| `qr_duration_minutes` | `120` |
| `buffet_price_adult` / `_child` / `_senior` / `_disabled` | `0` |

### 3.14 `system_logs` & `schema_migrations`
- `system_logs` — log เหตุการณ์ระบบ (`action` + `details` JSONB) แยกจาก `stock_movements` ชัดเจน
- `schema_migrations` — ตารางติดตาม migration ที่ apply แล้ว (สร้างโดย `apps/api/scripts/migrate.mjs` ไม่ใช่ไฟล์ migration)

---

## 4. Views

| View | หน้าที่ |
|---|---|
| `ingredient_usage_by_weekday` | ยอดใช้เฉลี่ยรายวันของสัปดาห์ (รวมยอดรายวันก่อน แล้วค่อยเฉลี่ย เพื่อไม่ให้การตัดข้ามล็อตทำให้ค่าเพี้ยน) |
| `cancelled_orders_with_deductions` | ตัวช่วย audit: หาออเดอร์ที่ถูกยกเลิกแต่ยังมีการตัดสต็อกค้างอยู่ |

## 5. Functions

| Function | หน้าที่ |
|---|---|
| `deduct_stock_fifo()` | ตัดสต็อกแบบ FIFO ข้ามหลายล็อต — ล็อกและรวมยอดให้ครบก่อนตัดจริง (atomic) |
| `auto_confirm_order()` | ยืนยันออเดอร์อัตโนมัติ + ตัดสต็อก ถ้าของไม่พอจะ rollback แล้วยกเลิกออเดอร์ทั้งใบ |
| `return_order_item_to_stock()` | คืนของกลับล็อตเดิม (เฉพาะส่วนที่ยังไม่เสิร์ฟ) — วันหมดอายุคงเดิม |
| `mark_not_fresh_lots()` | ตั้ง `is_not_fresh` เมื่อเลยวันหมดอายุ |
| `expire_table_sessions()` | ปิด session หมดเวลา (+60 วิ grace) และยกเลิกเฉพาะออเดอร์ที่ยัง pending |
| `flag_waste_candidates()` | เสนอของเสีย (ใกล้หมดอายุ + ไม่มีการเคลื่อนไหว) — rule-based ล้วน |
| `get_thaw_prep_recommendation()` | แนะนำดึงของจาก Freezer มาตู้พักละลาย (เลขคณิตล้วน) |
| `get_procurement_recommendation()` | แนะนำยอดสั่งซื้อจากเทรนด์ 4 vs 8 สัปดาห์ |
| `get_weekly_cost_profit_report()` | รายงานกำไร/ต้นทุน/ของเสียรายสัปดาห์ + ประโยคสรุปภาษาไทย |
| `check_freezer_expiry_warnings()` | log เตือนล็อตเนื้อใน Freezer ที่ใกล้หมดอายุ |
| `generate_cashier_time_notifications()` | สร้างแจ้งเตือน 30 นาที / 5 นาที / หมดเวลา ให้แคชเชียร์ |

## 6. Triggers & Cron

- **Trigger** `trg_check_stock_threshold` — ยิงทุกครั้งที่ `stock_lots.quantity_remaining` เปลี่ยน เพื่อเช็คว่าต่ำกว่าเกณฑ์หรือยัง แล้วเขียน `system_logs`
- **pg_cron** — งานตามเวลา: `mark_not_fresh_lots`, `expire_table_sessions`, `check_freezer_expiry_warnings`, `flag_waste_candidates`, auto-confirm sweep, และ `generate_cashier_time_notifications` (ทุก 1 นาที)

---

## 7. ลำดับ Migration

| ไฟล์ | สิ่งที่เพิ่ม/แก้ |
|---|---|
| `0001_init` | schema หลักทั้งหมด + functions + trigger |
| `0002_cashier_hardening` | `cashier_notifications`, `cashier_payments`, CHECK ต้องมีลูกค้าอย่างน้อย 1 คน |
| `0003`–`0006` | pg_cron, `orders.acknowledged_at`, ลายเซ็นการตัดสต็อก, FIFO expiry guard |
| `0007_menu_catalog` | `menu_items`: `category`, `image_path`, `image_alt`, `sort_order` |
| `0008_order_bom_snapshot` | `order_item_bom` (freeze สูตร) |
| `0009`–`0010` | เปลี่ยนชื่อหมวดเนื้อ, `menu_items.is_deleted` |
| `0011_menu_categories` | ตาราง `menu_categories` |
| `0012_ingredient_archiving` | `ingredients.is_active` |
| `0013`, `0015`, `0016` | cron เตือนหมดอายุ, สแกนของเสีย, auto-confirm ของเสีย |
| `0014_table_management` | `dining_tables.is_hidden`, `is_deleted` |
| `0017_limit_payment_methods` | ตัด `card` ออก เหลือ `cash` / `promptpay` |
| `0018_staff_workflow_hardening` | `orders.acknowledged_by`, `lot_headers.supplier_reference` |
| `0019_order_lifecycle_and_notifications` | `cashier_notifications.notification_type` + cron แจ้งเตือนเวลา |
| `0020_session_checkout_locking` | ล็อกกันชำระเงินซ้อน |
| `0021_fifo_wait_and_legacy_claims` | ปรับ FIFO รอล็อก + เคลียร์ claim ค้าง |
| `0022_partial_serving_and_handoffs` | `order_items`: `served_quantity`, `last_served_at/by` + ตาราง `order_item_serving_events` |
| `0023`–`0024` | เติม `stock_movements.order_item_id` และอนุญาต `movement_type = 'return'` สำหรับ DB เก่า |
