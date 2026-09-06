-- Use the customer-facing Thai label consistently for the meat menu category.
UPDATE menu_items SET category = 'เนื้อสัตว์' WHERE category = 'เนื้อ';
ALTER TABLE menu_items ALTER COLUMN category SET DEFAULT 'เนื้อสัตว์';
