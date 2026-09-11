-- Legacy databases may still have the original movement-type constraint
-- without the `return` value, even though stock-return functions insert it.

ALTER TABLE stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements
    ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type IN ('intake', 'adjustment', 'deduction', 'return'));
