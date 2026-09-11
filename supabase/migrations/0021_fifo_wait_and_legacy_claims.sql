-- Locked stock must be waited for, not treated as unavailable.
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
 p_ingredient_id BIGINT, p_plates_needed INT, p_order_id BIGINT, p_order_item_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
 v_lot RECORD;
 v_ids BIGINT[] := '{}';
 v_total NUMERIC := 0;
 v_remaining INT := p_plates_needed;
 v_take INT;
BEGIN
 IF p_plates_needed IS NULL OR p_plates_needed <= 0 THEN RAISE EXCEPTION 'Plate quantity must be positive'; END IF;
 FOR v_lot IN
  SELECT id, quantity_remaining FROM stock_lots
  WHERE ingredient_id = p_ingredient_id
   AND storage_location_id = (SELECT id FROM storage_locations WHERE name = 'ตู้พักละลาย')
   AND NOT is_not_fresh AND expiry_date > clock_timestamp() AND quantity_remaining > 0
  ORDER BY expiry_date, created_at, id FOR UPDATE
 LOOP
  v_ids := array_append(v_ids, v_lot.id);
  v_total := v_total + floor(v_lot.quantity_remaining);
 END LOOP;
 IF v_total < p_plates_needed THEN RETURN FALSE; END IF;
 FOR v_lot IN
  SELECT id, quantity_remaining FROM stock_lots WHERE id = ANY(v_ids)
  ORDER BY expiry_date, created_at, id
 LOOP
  EXIT WHEN v_remaining = 0;
  v_take := LEAST(v_remaining, floor(v_lot.quantity_remaining)::INT);
  IF v_take = 0 THEN CONTINUE; END IF;
  UPDATE stock_lots SET quantity_remaining = quantity_remaining - v_take WHERE id = v_lot.id;
  INSERT INTO stock_movements(stock_lot_id, movement_type, quantity, actor_id, order_id, order_item_id)
  VALUES(v_lot.id, 'deduction', -v_take, NULL, p_order_id, p_order_item_id);
  v_remaining := v_remaining - v_take;
 END LOOP;
 RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Only unfinished legacy claims with no owner return to unread.
UPDATE orders SET acknowledged_at = NULL
WHERE status = 'confirmed' AND served_at IS NULL
 AND acknowledged_at IS NOT NULL AND acknowledged_by IS NULL;

