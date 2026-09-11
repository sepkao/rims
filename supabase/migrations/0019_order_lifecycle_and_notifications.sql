-- Make order confirmation atomic and generate cashier time notifications in every environment.

CREATE OR REPLACE FUNCTION auto_confirm_order(p_order_id BIGINT) RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
    v_ok BOOLEAN;
BEGIN
    PERFORM 1
    FROM orders
    WHERE id = p_order_id
      AND status = 'pending'
      AND confirm_at <= now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    BEGIN
        FOR v_item IN
            SELECT oi.id AS order_item_id,
                   oib.ingredient_id,
                   oib.quantity_required_plates * oi.quantity AS plates_needed
            FROM order_items oi
            JOIN order_item_bom oib ON oib.order_item_id = oi.id
            WHERE oi.order_id = p_order_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM order_item_customizations oic
                  WHERE oic.order_item_id = oi.id
                    AND oic.ingredient_id = oib.ingredient_id
              )
        LOOP
            v_ok := deduct_stock_fifo(
                v_item.ingredient_id,
                v_item.plates_needed,
                p_order_id,
                v_item.order_item_id
            );
            IF NOT v_ok THEN
                RAISE EXCEPTION USING ERRCODE = 'R1001', MESSAGE = 'RIMS_INSUFFICIENT_STOCK';
            END IF;
        END LOOP;

        UPDATE orders
        SET status = 'confirmed', confirmed_at = now()
        WHERE id = p_order_id AND status = 'pending';
        RETURN TRUE;
    EXCEPTION WHEN SQLSTATE 'R1001' THEN
        -- Entering this handler rolls back every change made in the inner block.
        UPDATE orders
        SET status = 'cancelled', cancelled_at = now()
        WHERE id = p_order_id AND status = 'pending';
        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE cashier_notifications
    ADD COLUMN IF NOT EXISTS notification_type TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'cashier_notifications_type_check'
          AND conrelid = 'cashier_notifications'::regclass
    ) THEN
        ALTER TABLE cashier_notifications
            ADD CONSTRAINT cashier_notifications_type_check
            CHECK (notification_type IS NULL OR notification_type IN ('30_min', '5_min', 'expired'));
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cashier_notification_session_type
    ON cashier_notifications (table_session_id, notification_type)
    WHERE notification_type IS NOT NULL;

CREATE OR REPLACE FUNCTION generate_cashier_time_notifications() RETURNS INTEGER AS $$
DECLARE
    v_inserted INTEGER;
BEGIN
    INSERT INTO cashier_notifications (table_session_id, table_number, message, notification_type)
    SELECT ts.id,
           dt.table_number,
           CASE
               WHEN ts.expires_at <= now() THEN 'หมดเวลาทานบุฟเฟต์!'
               WHEN ts.expires_at <= now() + INTERVAL '5 minutes' THEN 'เหลือเวลา 5 นาที (ใกล้หมดเวลา)'
               ELSE 'เหลือเวลา 30 นาที'
           END,
           CASE
               WHEN ts.expires_at <= now() THEN 'expired'
               WHEN ts.expires_at <= now() + INTERVAL '5 minutes' THEN '5_min'
               ELSE '30_min'
           END
    FROM table_sessions ts
    JOIN dining_tables dt ON dt.id = ts.dining_table_id
    WHERE (ts.ended_at IS NULL OR (ts.expires_at <= now() AND ts.ended_at >= now() - INTERVAL '2 minutes'))
      AND ts.expires_at IS NOT NULL
      AND ts.expires_at <= now() + INTERVAL '30 minutes'
    ON CONFLICT (table_session_id, notification_type) WHERE notification_type IS NOT NULL
    DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;

-- pg_cron is installed by 0003. Replace any existing notification job safely.
DO $$
DECLARE
    v_job_id BIGINT;
BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'rims-cashier-time-notifications';
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END;
$$;

SELECT cron.schedule(
    'rims-cashier-time-notifications',
    '* * * * *',
    'SELECT public.generate_cashier_time_notifications();'
);

-- Read-only audit helper. Review results manually before correcting legacy stock.
CREATE OR REPLACE VIEW cancelled_orders_with_deductions AS
SELECT o.id AS order_id,
       o.table_session_id,
       o.cancelled_at,
       COUNT(sm.id) FILTER (WHERE sm.movement_type = 'deduction') AS deduction_count,
       COALESCE(SUM(-sm.quantity), 0) AS net_deducted
FROM orders o
JOIN stock_movements sm ON sm.order_id = o.id AND sm.movement_type IN ('deduction', 'return')
WHERE o.status = 'cancelled'
GROUP BY o.id, o.table_session_id, o.cancelled_at
HAVING COALESCE(SUM(-sm.quantity), 0) > 0;
