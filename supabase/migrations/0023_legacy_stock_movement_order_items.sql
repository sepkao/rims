-- Some legacy installations were marked as having 0001 applied while the
-- stock_movements.order_item_id column was absent. Both FIFO deduction and
-- stock return require this link for exact per-item traceability.

ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS order_item_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_stock_movements_order_item'
          AND conrelid = 'stock_movements'::regclass
    ) THEN
        ALTER TABLE stock_movements
            ADD CONSTRAINT fk_stock_movements_order_item
            FOREIGN KEY (order_item_id) REFERENCES order_items(id);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_order_item
    ON stock_movements (order_item_id);
