-- Expiry stops ordering; only a successful cashier checkout closes the bill.
-- All lifecycle writers lock the session before touching its orders.
CREATE OR REPLACE FUNCTION expire_table_sessions() RETURNS void AS $$
DECLARE
    v_session RECORD;
BEGIN
    FOR v_session IN
        SELECT id, dining_table_id FROM table_sessions
        WHERE ended_at IS NULL AND expires_at <= now()
        ORDER BY id
        FOR UPDATE
    LOOP
        UPDATE orders SET status = 'cancelled', cancelled_at = now()
        WHERE table_session_id = v_session.id AND status = 'pending';

        UPDATE dining_tables SET status = 'expired'
        WHERE id = v_session.dining_table_id AND status <> 'expired';
        -- Keep ended_at NULL, preserving checkout and the active-session uniqueness guard.
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_confirm_order(p_order_id BIGINT) RETURNS BOOLEAN AS $$
DECLARE
    v_session_id BIGINT;
    v_session RECORD;
    v_item RECORD;
BEGIN
    -- This lookup does not lock the order: checkout uses session -> order lock order.
    SELECT table_session_id INTO v_session_id FROM orders WHERE id = p_order_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    SELECT ended_at, expires_at INTO v_session
    FROM table_sessions WHERE id = v_session_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    PERFORM 1 FROM orders
    WHERE id = p_order_id AND table_session_id = v_session_id
      AND status = 'pending' AND confirm_at <= now()
    FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    IF v_session.ended_at IS NOT NULL OR v_session.expires_at <= clock_timestamp() THEN
        UPDATE orders SET status = 'cancelled', cancelled_at = now()
        WHERE id = p_order_id;
        RETURN FALSE;
    END IF;

    BEGIN
        FOR v_item IN
            SELECT oi.id AS order_item_id, oib.ingredient_id,
                   oib.quantity_required_plates * oi.quantity AS plates_needed
            FROM order_items oi
            JOIN order_item_bom oib ON oib.order_item_id = oi.id
            WHERE oi.order_id = p_order_id
              AND NOT EXISTS (
                  SELECT 1 FROM order_item_customizations oic
                  WHERE oic.order_item_id = oi.id AND oic.ingredient_id = oib.ingredient_id
              )
            ORDER BY oib.ingredient_id, oi.id
        LOOP
            IF NOT deduct_stock_fifo(v_item.ingredient_id, v_item.plates_needed,
                                     p_order_id, v_item.order_item_id) THEN
                RAISE EXCEPTION USING ERRCODE = 'R1001', MESSAGE = 'RIMS_INSUFFICIENT_STOCK';
            END IF;
        END LOOP;
        UPDATE orders SET status = 'confirmed', confirmed_at = now() WHERE id = p_order_id;
        RETURN TRUE;
    EXCEPTION WHEN SQLSTATE 'R1001' THEN
        UPDATE orders SET status = 'cancelled', cancelled_at = now() WHERE id = p_order_id;
        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql;
