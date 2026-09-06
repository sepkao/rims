-- Freeze the BOM used by each order item. Menu edits affect new orders only.
CREATE TABLE IF NOT EXISTS order_item_bom (
    order_item_id              BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    ingredient_id              BIGINT NOT NULL REFERENCES ingredients(id),
    quantity_required_plates   INT NOT NULL CHECK (quantity_required_plates > 0),
    removable                  BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (order_item_id, ingredient_id)
);

-- Preserve pending/legacy orders using the BOM that exists at migration time.
INSERT INTO order_item_bom (order_item_id, ingredient_id, quantity_required_plates, removable)
SELECT oi.id, mii.ingredient_id, mii.quantity_required_plates, mii.removable
FROM order_items oi
JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
ON CONFLICT (order_item_id, ingredient_id) DO NOTHING;

CREATE OR REPLACE FUNCTION auto_confirm_order(p_order_id BIGINT) RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
    v_ok BOOLEAN;
BEGIN
    FOR v_item IN
        SELECT oi.id AS order_item_id, oib.ingredient_id,
               oib.quantity_required_plates * oi.quantity AS plates_needed
        FROM order_items oi
        JOIN order_item_bom oib ON oib.order_item_id = oi.id
        WHERE oi.order_id = p_order_id
          AND oib.ingredient_id NOT IN (
              SELECT oic.ingredient_id FROM order_item_customizations oic WHERE oic.order_item_id = oi.id
          )
    LOOP
        v_ok := deduct_stock_fifo(v_item.ingredient_id, v_item.plates_needed, p_order_id, v_item.order_item_id);
        IF NOT v_ok THEN
            UPDATE orders SET status = 'cancelled', cancelled_at = now() WHERE id = p_order_id;
            RETURN FALSE;
        END IF;
    END LOOP;

    UPDATE orders SET status = 'confirmed', confirmed_at = now() WHERE id = p_order_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
