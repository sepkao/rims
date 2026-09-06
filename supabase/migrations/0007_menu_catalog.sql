-- Menu catalog metadata. Existing menu rows remain visible with the default category.
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'เนื้อสัตว์',
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS image_alt TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_menu_items_active_order
  ON menu_items (is_active, sort_order, name);
