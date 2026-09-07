ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
