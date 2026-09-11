ALTER TABLE orders
ADD COLUMN IF NOT EXISTS acknowledged_by BIGINT REFERENCES users(id);

ALTER TABLE lot_headers
ADD COLUMN IF NOT EXISTS supplier_reference TEXT;

CREATE OR REPLACE FUNCTION return_order_item_to_stock(
    p_order_item_id BIGINT,
    p_quantity INT,
    p_actor_id BIGINT
) RETURNS void AS $$
DECLARE
    v_order_id BIGINT;
    v_served_at TIMESTAMPTZ;
    v_status TEXT;
    v_quantity INT;
    v_quantity_returned INT;
    v_ingredient RECORD;
    v_lot RECORD;
    v_return_plates INT;
    v_take INT;
BEGIN
    SELECT oi.order_id, oi.quantity, oi.quantity_returned, o.served_at, o.status
    INTO v_order_id, v_quantity, v_quantity_returned, v_served_at, v_status
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.id = p_order_item_id
    FOR UPDATE OF oi, o;

    IF v_order_id IS NULL THEN RAISE EXCEPTION 'Order item not found'; END IF;
    IF v_served_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot return: order already served'; END IF;
    IF v_status <> 'confirmed' THEN RAISE EXCEPTION 'Cannot return: order is not confirmed'; END IF;
    IF p_quantity <= 0 OR v_quantity_returned + p_quantity > v_quantity THEN
        RAISE EXCEPTION 'Cannot return more than remaining quantity';
    END IF;

    FOR v_ingredient IN
        SELECT oib.ingredient_id, oib.quantity_required_plates
        FROM order_item_bom oib
        WHERE oib.order_item_id = p_order_item_id
          AND oib.ingredient_id NOT IN (
              SELECT oic.ingredient_id FROM order_item_customizations oic WHERE oic.order_item_id = p_order_item_id
          )
    LOOP
        v_return_plates := v_ingredient.quantity_required_plates * p_quantity;
        FOR v_lot IN
            SELECT sl.id AS stock_lot_id,
                   SUM(CASE WHEN sm.movement_type = 'deduction' THEN -sm.quantity ELSE 0 END)
                     - SUM(CASE WHEN sm.movement_type = 'return' THEN sm.quantity ELSE 0 END) AS net_returnable
            FROM stock_movements sm
            JOIN stock_lots sl ON sl.id = sm.stock_lot_id
            WHERE sm.order_item_id = p_order_item_id
              AND sl.ingredient_id = v_ingredient.ingredient_id
            GROUP BY sl.id, sl.expiry_date
            HAVING SUM(CASE WHEN sm.movement_type = 'deduction' THEN -sm.quantity ELSE 0 END)
                     - SUM(CASE WHEN sm.movement_type = 'return' THEN sm.quantity ELSE 0 END) > 0
            ORDER BY sl.expiry_date ASC
        LOOP
            EXIT WHEN v_return_plates <= 0;
            v_take := LEAST(v_return_plates, v_lot.net_returnable::INT);
            UPDATE stock_lots SET quantity_remaining = quantity_remaining + v_take WHERE id = v_lot.stock_lot_id;
            INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id, order_id, order_item_id)
            VALUES (v_lot.stock_lot_id, 'return', v_take, p_actor_id, v_order_id, p_order_item_id);
            v_return_plates := v_return_plates - v_take;
        END LOOP;
        IF v_return_plates > 0 THEN RAISE EXCEPTION 'Original deduction records are insufficient'; END IF;
    END LOOP;

    UPDATE order_items SET quantity_returned = quantity_returned + p_quantity WHERE id = p_order_item_id;
END;
$$ LANGUAGE plpgsql;
