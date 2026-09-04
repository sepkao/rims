-- Align the FIFO deduction function with auto_confirm_order's canonical
-- four-argument signature. Some existing databases still have the legacy
-- three-argument overload; keep it intact for backwards compatibility.
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
    p_ingredient_id BIGINT,
    p_plates_needed INT,
    p_order_id BIGINT,
    p_order_item_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_lot RECORD;
    v_remaining INT;
    v_take INT;
    v_total_available DECIMAL := 0;
BEGIN
    FOR v_lot IN
        SELECT id, quantity_remaining
        FROM stock_lots
        WHERE ingredient_id = p_ingredient_id
          AND storage_location_id = (SELECT id FROM storage_locations WHERE name = 'ตู้พักละลาย')
          AND is_not_fresh = false
          AND quantity_remaining > 0
        ORDER BY expiry_date ASC
        FOR UPDATE SKIP LOCKED
    LOOP
        v_total_available := v_total_available + v_lot.quantity_remaining;
    END LOOP;

    IF v_total_available < p_plates_needed THEN
        RETURN FALSE;
    END IF;

    v_remaining := p_plates_needed;
    FOR v_lot IN
        SELECT id, quantity_remaining
        FROM stock_lots
        WHERE ingredient_id = p_ingredient_id
          AND storage_location_id = (SELECT id FROM storage_locations WHERE name = 'ตู้พักละลาย')
          AND is_not_fresh = false
          AND quantity_remaining > 0
        ORDER BY expiry_date ASC
        FOR UPDATE SKIP LOCKED
    LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_remaining, v_lot.quantity_remaining::INT);
        UPDATE stock_lots
        SET quantity_remaining = quantity_remaining - v_take
        WHERE id = v_lot.id;
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'stock_movements'
              AND column_name = 'order_item_id'
        ) THEN
            EXECUTE 'INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id, order_id, order_item_id) VALUES ($1, $2, $3, NULL, $4, $5)'
                USING v_lot.id, 'deduction', -v_take, p_order_id, p_order_item_id;
        ELSE
            INSERT INTO stock_movements (
                stock_lot_id, movement_type, quantity, actor_id, order_id
            ) VALUES (
                v_lot.id, 'deduction', -v_take, NULL, p_order_id
            );
        END IF;
        v_remaining := v_remaining - v_take;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
