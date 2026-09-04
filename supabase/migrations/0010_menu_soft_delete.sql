-- Hide deleted menu items without breaking historical orders or their BOM snapshots.
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_menu_items_visible_order
  ON menu_items (is_deleted, is_active, sort_order, name);
