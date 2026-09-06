CREATE TABLE IF NOT EXISTS menu_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO menu_categories (name, sort_order)
VALUES ('เนื้อสัตว์', 10), ('ผัก', 20), ('เซ็ตคอมโบ', 30)
ON CONFLICT (name) DO NOTHING;

INSERT INTO menu_categories (name)
SELECT DISTINCT category FROM menu_items
WHERE category IS NOT NULL AND btrim(category) <> ''
ON CONFLICT (name) DO NOTHING;
