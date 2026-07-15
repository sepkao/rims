-- =====================================================================
-- RIMS Database Schema (PostgreSQL / Supabase)
-- Generated from rims_scope_lock_v2.md — do not edit business rules here,
-- edit the scope lock file first, then regenerate this file.
-- Storage model: 2 locations (Freezer=kg meat-only, ตู้พักละลาย=plates both)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. users — Owner creates staff/cashier accounts (F9); no self-registration
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'cashier')),
    created_by      BIGINT REFERENCES users(id),  -- NULL for the first Owner account
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. ingredients
-- ---------------------------------------------------------------------
CREATE TABLE ingredients (
    id                              BIGSERIAL PRIMARY KEY,
    name                            TEXT UNIQUE NOT NULL,          -- autocomplete matches this
    category                        TEXT NOT NULL CHECK (category IN ('meat', 'vegetable')),
    default_portion_size_kg         DECIMAL(6,3) NOT NULL,         -- e.g. 0.100 for meat, 0.050 for veg
    reorder_threshold_kg            DECIMAL(10,3),                 -- UC-N7, Freezer check — meat only, NULL for vegetable
    thaw_prep_threshold_plates      INT,                           -- UC-N10 (meat, staff-facing) / UC-N7 (vegetable, Owner-facing)
    freezer_expiry_warning_days     INT NOT NULL DEFAULT 3,        -- UC-N11 — meat only, ignored for vegetable
    buffer_percentage               DECIMAL(5,2) NOT NULL DEFAULT 15.00,  -- UC-N3 + UC-N8 formulas, Owner-set (e.g. 15.00 = +15%)
    supplier_pack_size_kg           DECIMAL(6,3),                  -- UC-N8: round recommendation up to this pack size, NULL = no rounding
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. storage_locations — exactly 2 rows, seeded below
-- ---------------------------------------------------------------------
CREATE TABLE storage_locations (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT UNIQUE NOT NULL,
    unit_type           TEXT NOT NULL CHECK (unit_type IN ('kg', 'plate')),
    accepts_category    TEXT NOT NULL CHECK (accepts_category IN ('meat', 'vegetable', 'both'))
);

INSERT INTO storage_locations (name, unit_type, accepts_category) VALUES
    ('Freezer', 'kg', 'meat'),
    ('ตู้พักละลาย', 'plate', 'both');

-- ---------------------------------------------------------------------
-- 4. lot_headers — 1 receiving round (UC-N1), atomic across all line items
-- ---------------------------------------------------------------------
CREATE TABLE lot_headers (
    id              BIGSERIAL PRIMARY KEY,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by     BIGINT NOT NULL REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- 5. stock_lots — line items. Unit of quantity/unit_cost depends on
--    storage_location_id (kg for Freezer, plate for ตู้พักละลาย).
--    Vegetable rows are created directly in ตู้พักละลาย at UC-N1 (already
--    converted to plates, source_lot_id NULL). Meat rows start in Freezer
--    (source_lot_id NULL) and UC-N2 creates a second row in ตู้พักละลาย
--    with source_lot_id pointing back to the Freezer row.
-- ---------------------------------------------------------------------
CREATE TABLE stock_lots (
    id                      BIGSERIAL PRIMARY KEY,
    lot_header_id           BIGINT NOT NULL REFERENCES lot_headers(id),
    ingredient_id           BIGINT NOT NULL REFERENCES ingredients(id),
    storage_location_id     BIGINT NOT NULL REFERENCES storage_locations(id),
    quantity_original       DECIMAL(12,3) NOT NULL CHECK (quantity_original >= 0),
    quantity_remaining      DECIMAL(12,3) NOT NULL CHECK (quantity_remaining >= 0),
    unit_cost               DECIMAL(12,2) NOT NULL,  -- THB per this row's own unit (kg or plate)
    expiry_date             TIMESTAMPTZ NOT NULL,
    source_lot_id           BIGINT REFERENCES stock_lots(id),  -- UC-N2 sub-lot parent (meat only)
    is_not_fresh            BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_lots_ingredient_storage ON stock_lots (ingredient_id, storage_location_id) WHERE quantity_remaining > 0;
CREATE INDEX idx_stock_lots_expiry ON stock_lots (expiry_date) WHERE is_not_fresh = false;
CREATE INDEX idx_stock_lots_source ON stock_lots (source_lot_id);

-- ---------------------------------------------------------------------
-- 6. stock_movements — full audit trail (also serves as UC-N2's audit log, E5)
-- ---------------------------------------------------------------------
CREATE TABLE stock_movements (
    id              BIGSERIAL PRIMARY KEY,
    stock_lot_id    BIGINT NOT NULL REFERENCES stock_lots(id),
    movement_type   TEXT NOT NULL CHECK (movement_type IN ('intake', 'adjustment', 'deduction')),
    quantity        DECIMAL(12,3) NOT NULL,  -- positive=intake, negative=deduction/adjustment-out
    actor_id        BIGINT REFERENCES users(id),  -- NULL = system (e.g. auto-confirm deduction)
    order_id        BIGINT,  -- FK added after orders table exists (see bottom)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_lot ON stock_movements (stock_lot_id);

-- ---------------------------------------------------------------------
-- VIEW: average usage per ingredient per day-of-week, feeds UC-N3's
-- formula (แนะนำดึงเพิ่ม = ค่าเฉลี่ยยอดใช้ของวันนี้ในสัปดาห์ × buffer − ของเหลือ)
-- and its cold-start check (days_sampled too low -> "ข้อมูลไม่พอ").
-- ---------------------------------------------------------------------
CREATE VIEW ingredient_usage_by_weekday AS
SELECT
    sl.ingredient_id,
    EXTRACT(DOW FROM sm.created_at)::INT AS day_of_week,  -- 0=Sunday .. 6=Saturday
    AVG(-sm.quantity) AS avg_quantity_used,               -- deduction rows store quantity negative
    COUNT(DISTINCT sm.created_at::date) AS days_sampled
FROM stock_movements sm
JOIN stock_lots sl ON sl.id = sm.stock_lot_id
WHERE sm.movement_type = 'deduction'
GROUP BY sl.ingredient_id, EXTRACT(DOW FROM sm.created_at);

-- ---------------------------------------------------------------------
-- 7. waste_records — AI Task 2 proposes, Owner confirms/rejects
-- ---------------------------------------------------------------------
CREATE TABLE waste_records (
    id                  BIGSERIAL PRIMARY KEY,
    stock_lot_id        BIGINT NOT NULL REFERENCES stock_lots(id),
    quantity            DECIMAL(12,3) NOT NULL,
    unit_cost_snapshot  DECIMAL(12,2) NOT NULL,             -- copied from stock_lots.unit_cost at creation time
    waste_cost          DECIMAL(12,2) NOT NULL,             -- quantity * unit_cost_snapshot, unit-agnostic THB
    ai_reason           TEXT,
    ai_confidence       DECIMAL(4,3),
    status              TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'confirmed', 'rejected')),
    reviewed_by         BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. menu_items
-- ---------------------------------------------------------------------
CREATE TABLE menu_items (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    price           DECIMAL(10,2) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 9. menu_item_ingredients — BOM. removable=true enables UC-N9 for that ingredient.
-- ---------------------------------------------------------------------
CREATE TABLE menu_item_ingredients (
    id                          BIGSERIAL PRIMARY KEY,
    menu_item_id                BIGINT NOT NULL REFERENCES menu_items(id),
    ingredient_id               BIGINT NOT NULL REFERENCES ingredients(id),
    quantity_required_plates    INT NOT NULL DEFAULT 1,   -- plates of this ingredient per 1x menu item ordered
    removable                   BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (menu_item_id, ingredient_id)
);

-- ---------------------------------------------------------------------
-- 10. dining_tables — current state only
-- ---------------------------------------------------------------------
CREATE TABLE dining_tables (
    id              BIGSERIAL PRIMARY KEY,
    table_number    TEXT UNIQUE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'empty'
                    CHECK (status IN ('empty', 'occupied', 'near_expiry', 'expired', 'pending_cleanup'))
);

-- ---------------------------------------------------------------------
-- settings — simple key/value store. Currently just the QR duration rule
-- (Owner sets this once, applies to every table_session — worksheet ข้อ 3).
-- ---------------------------------------------------------------------
CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES ('qr_duration_minutes', '120');

-- ---------------------------------------------------------------------
-- 11. table_sessions — history (B5). expires_at = started_at + Owner-set QR duration (e.g. 2h)
-- ---------------------------------------------------------------------
CREATE TABLE table_sessions (
    id                  BIGSERIAL PRIMARY KEY,
    dining_table_id     BIGINT NOT NULL REFERENCES dining_tables(id),
    qr_code             TEXT NOT NULL,
    opened_by           BIGINT NOT NULL REFERENCES users(id),  -- cashier, check-in
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ,
    ended_by            BIGINT REFERENCES users(id)  -- cashier if manual early close, NULL if auto-expired
);

CREATE INDEX idx_table_sessions_active ON table_sessions (dining_table_id) WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------
-- 12. orders — single stock-deduction point is auto-confirm (System), not submit
-- ---------------------------------------------------------------------
CREATE TABLE orders (
    id                  BIGSERIAL PRIMARY KEY,
    table_session_id    BIGINT NOT NULL REFERENCES table_sessions(id),
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirm_at          TIMESTAMPTZ NOT NULL,  -- created_at + GRACE_PERIOD_SECONDS (60s), when auto-confirm should fire
    confirmed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    served_at           TIMESTAMPTZ  -- staff marks this from OrdersToServe.tsx; NULL = still waiting to be served
);

CREATE INDEX idx_orders_pending_confirm ON orders (confirm_at) WHERE status = 'pending';

ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_order
    FOREIGN KEY (order_id) REFERENCES orders(id);

-- ---------------------------------------------------------------------
-- 13. order_items
-- ---------------------------------------------------------------------
CREATE TABLE order_items (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id),
    menu_item_id    BIGINT NOT NULL REFERENCES menu_items(id),
    quantity        INT NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

-- ---------------------------------------------------------------------
-- 14. order_item_customizations — UC-N9, cut-only (boolean per ingredient)
-- ---------------------------------------------------------------------
CREATE TABLE order_item_customizations (
    id              BIGSERIAL PRIMARY KEY,
    order_item_id   BIGINT NOT NULL REFERENCES order_items(id),
    ingredient_id   BIGINT NOT NULL REFERENCES ingredients(id),  -- ingredient removed from this dish
    UNIQUE (order_item_id, ingredient_id)
);

-- ---------------------------------------------------------------------
-- 15. system_logs — separate from stock_movements (B3)
-- ---------------------------------------------------------------------
CREATE TABLE system_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_id        BIGINT REFERENCES users(id),
    action          TEXT NOT NULL,
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

-- ---------------------------------------------------------------------
-- FIFO atomic deduction for one ingredient's plate requirement.
-- Picks the oldest (by expiry_date) non-not-fresh lot in ตู้พักละลาย with
-- enough quantity_remaining, and atomically decrements it.
-- Returns TRUE on success, FALSE if nothing had enough stock (caller cancels order).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
    p_ingredient_id BIGINT,
    p_plates_needed INT,
    p_order_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_lot_id BIGINT;
    v_rows_affected INT;
BEGIN
    SELECT id INTO v_lot_id
    FROM stock_lots
    WHERE ingredient_id = p_ingredient_id
      AND storage_location_id = (SELECT id FROM storage_locations WHERE name = 'ตู้พักละลาย')
      AND is_not_fresh = false
      AND quantity_remaining >= p_plates_needed
    ORDER BY expiry_date ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_lot_id IS NULL THEN
        RETURN FALSE;  -- not enough stock anywhere — order should be cancelled (first-confirm-wins loser)
    END IF;

    UPDATE stock_lots
    SET quantity_remaining = quantity_remaining - p_plates_needed
    WHERE id = v_lot_id AND quantity_remaining >= p_plates_needed;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    IF v_rows_affected = 0 THEN
        RETURN FALSE;  -- lost the race between SELECT and UPDATE
    END IF;

    INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id, order_id)
    VALUES (v_lot_id, 'deduction', -p_plates_needed, NULL, p_order_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Auto-confirm an order: deducts every order_item's ingredients (minus
-- UC-N9 removed ones) via deduct_stock_fifo. If ANY ingredient runs out,
-- the whole order is cancelled (no partial fulfillment) and nothing already
-- deducted in this call is rolled back automatically — wrap the call site
-- in one transaction so a FALSE return triggers ROLLBACK + order cancel.
-- Called by the scheduler when now() >= orders.confirm_at (see cron section).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_confirm_order(p_order_id BIGINT) RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
    v_ok BOOLEAN;
BEGIN
    FOR v_item IN
        SELECT mii.ingredient_id, mii.quantity_required_plates * oi.quantity AS plates_needed
        FROM order_items oi
        JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
        WHERE oi.order_id = p_order_id
          AND mii.ingredient_id NOT IN (
              SELECT oic.ingredient_id FROM order_item_customizations oic WHERE oic.order_item_id = oi.id
          )
    LOOP
        v_ok := deduct_stock_fifo(v_item.ingredient_id, v_item.plates_needed, p_order_id);
        IF NOT v_ok THEN
            UPDATE orders SET status = 'cancelled', cancelled_at = now() WHERE id = p_order_id;
            RETURN FALSE;
        END IF;
    END LOOP;

    UPDATE orders SET status = 'confirmed', confirmed_at = now() WHERE id = p_order_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Mark lots "not fresh" once expiry_date has passed (scheduled, not a trigger —
-- "time passing" isn't a row-modification event).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_not_fresh_lots() RETURNS void AS $$
BEGIN
    UPDATE stock_lots
    SET is_not_fresh = true
    WHERE is_not_fresh = false
      AND expiry_date <= now()
      AND quantity_remaining > 0;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Close expired table sessions (2h + 1min grace, worksheet C4) and cancel
-- only their still-pending orders (confirmed orders already in the kitchen
-- are left alone — worksheet C1).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_table_sessions() RETURNS void AS $$
DECLARE
    v_session RECORD;
BEGIN
    FOR v_session IN
        SELECT id, dining_table_id FROM table_sessions
        WHERE ended_at IS NULL
          AND expires_at + INTERVAL '60 seconds' <= now()  -- GRACE_PERIOD_SECONDS shared constant
    LOOP
        UPDATE orders SET status = 'cancelled', cancelled_at = now()
        WHERE table_session_id = v_session.id AND status = 'pending';

        UPDATE table_sessions SET ended_at = now() WHERE id = v_session.id;
        UPDATE dining_tables SET status = 'pending_cleanup' WHERE id = v_session.dining_table_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Waste-candidate flagging — rule-based, NOT an AI/LLM call (free to run
-- as often as you like, unlike a Claude API scan). Flags a lot as
-- 'pending_review' in waste_records when it's close to expiry AND has had
-- no stock_movements activity recently. ai_reason is a templated string,
-- ai_confidence stays NULL (no model involved). Owner still confirms/rejects
-- via PUT /waste-records/:id exactly as before.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION flag_waste_candidates() RETURNS void AS $$
BEGIN
    INSERT INTO waste_records (stock_lot_id, quantity, unit_cost_snapshot, waste_cost, ai_reason, ai_confidence, status)
    SELECT
        sl.id,
        sl.quantity_remaining,
        sl.unit_cost,
        sl.quantity_remaining * sl.unit_cost,
        'ใกล้หมดอายุ (ภายใน 2 วัน) และไม่มีการเคลื่อนไหวมากกว่า 3 วัน',
        NULL,
        'pending_review'
    FROM stock_lots sl
    WHERE sl.is_not_fresh = false
      AND sl.quantity_remaining > 0
      AND sl.expiry_date <= now() + INTERVAL '2 days'
      AND NOT EXISTS (
          SELECT 1 FROM stock_movements sm
          WHERE sm.stock_lot_id = sl.id AND sm.created_at > now() - INTERVAL '3 days'
      )
      AND NOT EXISTS (
          SELECT 1 FROM waste_records wr
          WHERE wr.stock_lot_id = sl.id AND wr.status = 'pending_review'
      );
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- UC-N3: thaw-prep daily pull recommendation — pure arithmetic, NO AI.
-- Formula: แนะนำดึงเพิ่ม = (ค่าเฉลี่ยยอดใช้ของวันนี้ในสัปดาห์ × (1+buffer%)) − ของเหลือในตู้พักตอนนี้
-- Units: plates throughout (deductions already happen in plates from ตู้พักละลาย).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_thaw_prep_recommendation()
RETURNS TABLE (
    ingredient_id BIGINT,
    ingredient_name TEXT,
    avg_usage_today_plates DECIMAL,
    days_sampled BIGINT,
    current_plates DECIMAL,
    recommended_pull_plates DECIMAL,
    cold_start BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.name,
        COALESCE(u.avg_quantity_used, 0),
        COALESCE(u.days_sampled, 0),
        COALESCE(sl.total_plates, 0),
        GREATEST(COALESCE(u.avg_quantity_used, 0) * (1 + i.buffer_percentage / 100.0) - COALESCE(sl.total_plates, 0), 0),
        COALESCE(u.days_sampled, 0) < 3  -- fewer than 3 same-weekday samples -> cold start, tell staff to enter manually
    FROM ingredients i
    LEFT JOIN ingredient_usage_by_weekday u
        ON u.ingredient_id = i.id AND u.day_of_week = EXTRACT(DOW FROM now())::INT
    LEFT JOIN (
        SELECT ingredient_id, SUM(quantity_remaining) AS total_plates
        FROM stock_lots
        WHERE storage_location_id = (SELECT id FROM storage_locations WHERE name = 'ตู้พักละลาย')
          AND is_not_fresh = false
        GROUP BY ingredient_id
    ) sl ON sl.ingredient_id = i.id;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- UC-N8: procurement recommendation — pure arithmetic, NO AI.
-- Formula: แนะนำ = ค่าเฉลี่ยยอดใช้ล่าสุด(kg) × (1 + %เทรนด์เทียบรอบก่อนหน้า) × (1+buffer%),
--          ปัดขึ้นเป็นหน่วย supplier_pack_size_kg ถ้ามีข้อมูล
-- "ล่าสุด" = เฉลี่ยรายสัปดาห์ 4 สัปดาห์ที่ผ่านมา, "รอบก่อนหน้า" = 4 สัปดาห์ก่อนหน้านั้น (สัปดาห์ 5-8 ที่แล้ว)
-- Deductions happen in plates (ตู้พักละลาย) — converted back to kg-equivalent via
-- default_portion_size_kg since Owner orders raw kg from the supplier, not plates.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_procurement_recommendation()
RETURNS TABLE (
    ingredient_id BIGINT,
    ingredient_name TEXT,
    recent_avg_weekly_kg DECIMAL,
    trend_percentage DECIMAL,
    recommended_order_kg DECIMAL,
    cold_start BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH weekly_usage AS (
        SELECT
            sl.ingredient_id,
            date_trunc('week', sm.created_at) AS week_start,
            SUM(-sm.quantity * i.default_portion_size_kg) AS used_kg
        FROM stock_movements sm
        JOIN stock_lots sl ON sl.id = sm.stock_lot_id
        JOIN ingredients i ON i.id = sl.ingredient_id
        WHERE sm.movement_type = 'deduction'
          AND sm.created_at >= now() - INTERVAL '8 weeks'
        GROUP BY sl.ingredient_id, date_trunc('week', sm.created_at)
    ),
    recent AS (
        SELECT ingredient_id, AVG(used_kg) AS avg_recent, COUNT(*) AS n_recent
        FROM weekly_usage WHERE week_start >= now() - INTERVAL '4 weeks'
        GROUP BY ingredient_id
    ),
    previous AS (
        SELECT ingredient_id, AVG(used_kg) AS avg_previous
        FROM weekly_usage WHERE week_start < now() - INTERVAL '4 weeks'
        GROUP BY ingredient_id
    ),
    calc AS (
        SELECT
            i.id, i.name, i.buffer_percentage, i.supplier_pack_size_kg,
            COALESCE(r.avg_recent, 0) AS avg_recent,
            CASE WHEN COALESCE(p.avg_previous, 0) > 0
                 THEN (r.avg_recent - p.avg_previous) / p.avg_previous
                 ELSE 0 END AS trend_ratio,
            COALESCE(r.n_recent, 0) AS n_recent
        FROM ingredients i
        LEFT JOIN recent r ON r.ingredient_id = i.id
        LEFT JOIN previous p ON p.ingredient_id = i.id
    )
    SELECT
        c.id, c.name,
        ROUND(c.avg_recent::numeric, 2),
        ROUND((c.trend_ratio * 100)::numeric, 1),
        CASE
            WHEN c.supplier_pack_size_kg IS NOT NULL AND c.supplier_pack_size_kg > 0 THEN
                CEIL((c.avg_recent * (1 + c.trend_ratio) * (1 + c.buffer_percentage / 100.0)) / c.supplier_pack_size_kg)
                    * c.supplier_pack_size_kg
            ELSE
                ROUND((c.avg_recent * (1 + c.trend_ratio) * (1 + c.buffer_percentage / 100.0))::numeric, 2)
        END,
        c.n_recent < 2  -- fewer than 2 weekly samples -> cold start, don't guess
    FROM calc c;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Weekly cost/profit report — pure SQL + a templated Thai sentence
-- (string formatting, NOT an LLM call). revenue/COGS/waste all computed
-- deterministically from existing tables.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_weekly_cost_profit_report(p_week_start DATE DEFAULT date_trunc('week', now())::date)
RETURNS TABLE (
    week_start DATE,
    revenue DECIMAL,
    cogs DECIMAL,
    waste_cost DECIMAL,
    profit DECIMAL,
    profit_margin_pct DECIMAL,
    narrative TEXT
) AS $$
DECLARE
    v_revenue DECIMAL;
    v_cogs DECIMAL;
    v_waste DECIMAL;
    v_profit DECIMAL;
    v_prev_profit DECIMAL;
    v_trend DECIMAL;
BEGIN
    SELECT COALESCE(SUM(oi.quantity * mi.price), 0) INTO v_revenue
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE o.status = 'confirmed'
      AND o.confirmed_at >= p_week_start AND o.confirmed_at < p_week_start + INTERVAL '7 days';

    SELECT COALESCE(SUM(-sm.quantity * sl.unit_cost), 0) INTO v_cogs
    FROM stock_movements sm
    JOIN stock_lots sl ON sl.id = sm.stock_lot_id
    WHERE sm.movement_type = 'deduction'
      AND sm.created_at >= p_week_start AND sm.created_at < p_week_start + INTERVAL '7 days';

    SELECT COALESCE(SUM(wr.waste_cost), 0) INTO v_waste
    FROM waste_records wr
    WHERE wr.status = 'confirmed'
      AND wr.created_at >= p_week_start AND wr.created_at < p_week_start + INTERVAL '7 days';

    v_profit := v_revenue - v_cogs - v_waste;

    SELECT (prev.revenue - prev.cogs - prev.waste) INTO v_prev_profit
    FROM (
        SELECT
          (SELECT COALESCE(SUM(oi2.quantity * mi2.price), 0) FROM orders o2
             JOIN order_items oi2 ON oi2.order_id = o2.id JOIN menu_items mi2 ON mi2.id = oi2.menu_item_id
             WHERE o2.status = 'confirmed' AND o2.confirmed_at >= p_week_start - INTERVAL '7 days' AND o2.confirmed_at < p_week_start) AS revenue,
          (SELECT COALESCE(SUM(-sm2.quantity * sl2.unit_cost), 0) FROM stock_movements sm2
             JOIN stock_lots sl2 ON sl2.id = sm2.stock_lot_id
             WHERE sm2.movement_type = 'deduction' AND sm2.created_at >= p_week_start - INTERVAL '7 days' AND sm2.created_at < p_week_start) AS cogs,
          (SELECT COALESCE(SUM(wr2.waste_cost), 0) FROM waste_records wr2
             WHERE wr2.status = 'confirmed' AND wr2.created_at >= p_week_start - INTERVAL '7 days' AND wr2.created_at < p_week_start) AS waste
    ) prev;

    v_trend := CASE WHEN v_prev_profit IS NOT NULL AND v_prev_profit != 0
                    THEN ROUND(((v_profit - v_prev_profit) / ABS(v_prev_profit) * 100)::numeric, 1)
                    ELSE NULL END;

    RETURN QUERY SELECT
        p_week_start,
        v_revenue, v_cogs, v_waste, v_profit,
        CASE WHEN v_revenue > 0 THEN ROUND((v_profit / v_revenue * 100)::numeric, 1) ELSE 0 END,
        format('สัปดาห์นี้กำไร %s บาท (รายได้ %s − ต้นทุนวัตถุดิบ %s − ของเสีย %s บาท)%s',
               v_profit, v_revenue, v_cogs, v_waste,
               CASE WHEN v_trend IS NOT NULL THEN format(', เปลี่ยนจากสัปดาห์ก่อน %s%%', v_trend) ELSE '' END);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- UC-N11 only: Freezer meat lot entering its warning window (time-based,
-- so it stays a scheduled scan, not a trigger). UC-N7/UC-N10 moved to an
-- event-driven trigger below since they react to quantity_remaining changes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_freezer_expiry_warnings() RETURNS void AS $$
BEGIN
    INSERT INTO system_logs (action, details)
    SELECT 'UC-N11_freezer_near_expiry',
           jsonb_build_object('stock_lot_id', sl.id, 'ingredient_id', sl.ingredient_id, 'expiry_date', sl.expiry_date)
    FROM stock_lots sl
    JOIN ingredients i ON i.id = sl.ingredient_id
    JOIN storage_locations loc ON loc.id = sl.storage_location_id
    WHERE loc.name = 'Freezer'
      AND sl.is_not_fresh = false
      AND sl.quantity_remaining > 0
      AND sl.expiry_date <= now() + (i.freezer_expiry_warning_days || ' days')::INTERVAL
      -- avoid re-logging a lot that was already warned about today
      AND NOT EXISTS (
          SELECT 1 FROM system_logs sg
          WHERE sg.action = 'UC-N11_freezer_near_expiry'
            AND (sg.details->>'stock_lot_id')::BIGINT = sl.id
            AND sg.created_at::date = now()::date
      );
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- UC-N7 (Owner) + UC-N10 (staff, meat only) — event-driven: fires whenever
-- a lot's quantity_remaining changes (deduction, adjustment, or new intake),
-- since that's the only thing that can push a total below threshold.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_check_stock_threshold() RETURNS TRIGGER AS $$
DECLARE
    v_ingredient        ingredients%ROWTYPE;
    v_freezer_id        BIGINT := (SELECT id FROM storage_locations WHERE name = 'Freezer');
    v_thawprep_id       BIGINT := (SELECT id FROM storage_locations WHERE name = 'ตู้พักละลาย');
    v_total             DECIMAL;
BEGIN
    SELECT * INTO v_ingredient FROM ingredients WHERE id = NEW.ingredient_id;

    IF NEW.storage_location_id = v_freezer_id THEN
        -- UC-N7 for meat: raw kg in Freezer vs reorder_threshold_kg -> notify Owner
        -- (is_not_fresh excluded: spoiled stock isn't usable stock, would understate the need to reorder)
        SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_total
        FROM stock_lots
        WHERE ingredient_id = NEW.ingredient_id AND storage_location_id = v_freezer_id AND is_not_fresh = false;

        IF v_ingredient.reorder_threshold_kg IS NOT NULL AND v_total < v_ingredient.reorder_threshold_kg THEN
            INSERT INTO system_logs (action, details) VALUES (
                'UC-N7_low_stock', jsonb_build_object(
                    'ingredient_id', NEW.ingredient_id, 'storage', 'Freezer',
                    'remaining_kg', v_total, 'threshold_kg', v_ingredient.reorder_threshold_kg
                )
            );
        END IF;

    ELSIF NEW.storage_location_id = v_thawprep_id THEN
        -- ตู้พักละลาย plates vs thaw_prep_threshold_plates -> which UC fires depends on category
        SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_total
        FROM stock_lots
        WHERE ingredient_id = NEW.ingredient_id AND storage_location_id = v_thawprep_id AND is_not_fresh = false;

        IF v_ingredient.thaw_prep_threshold_plates IS NOT NULL AND v_total < v_ingredient.thaw_prep_threshold_plates THEN
            IF v_ingredient.category = 'meat' THEN
                -- UC-N10: notify staff to go pull more from Freezer (action exists)
                INSERT INTO system_logs (action, details) VALUES (
                    'UC-N10_low_stock', jsonb_build_object(
                        'ingredient_id', NEW.ingredient_id, 'remaining_plates', v_total,
                        'threshold_plates', v_ingredient.thaw_prep_threshold_plates
                    )
                );
            ELSE
                -- vegetable: no lot to pull from anymore (F3d) -> this is a supplier-reorder
                -- signal instead, so it's UC-N7's job here, not UC-N10's
                INSERT INTO system_logs (action, details) VALUES (
                    'UC-N7_low_stock', jsonb_build_object(
                        'ingredient_id', NEW.ingredient_id, 'storage', 'ตู้พักละลาย',
                        'remaining_plates', v_total, 'threshold_plates', v_ingredient.thaw_prep_threshold_plates
                    )
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_stock_threshold
AFTER INSERT OR UPDATE OF quantity_remaining ON stock_lots
FOR EACH ROW
EXECUTE FUNCTION trg_fn_check_stock_threshold();

-- =====================================================================
-- Scheduling note: run mark_not_fresh_lots(), expire_table_sessions(),
-- check_freezer_expiry_warnings(), flag_waste_candidates(), and the
-- auto_confirm_order() sweep (orders where confirm_at <= now() AND
-- status='pending') on a short interval (e.g. every 10-15s) via pg_cron
-- (Supabase) or an app-level scheduler — all of these are free SQL, so
-- there's no cost concern running them often. trg_check_stock_threshold
-- needs no scheduling — it fires automatically on every stock_lots write.
-- =====================================================================
