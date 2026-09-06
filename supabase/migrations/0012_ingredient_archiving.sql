-- Preserve historical stock/order references while allowing owners to retire
-- ingredients from all new operational workflows.
ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ingredients_active_name
ON ingredients (is_active, name);
