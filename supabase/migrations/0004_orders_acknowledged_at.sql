-- 0004_orders_acknowledged_at.sql
-- Adds acknowledged_at to track when kitchen staff acknowledges/reads an order (transitions to 'serving' / 'in prep')

ALTER TABLE orders ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_acknowledged ON orders (acknowledged_at) WHERE status = 'confirmed' AND served_at IS NULL;
