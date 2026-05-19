-- Soft delete for dictionary tables
-- Instead of hard-deleting entries that may be referenced by historical records,
-- we mark them as archived. Historical joins still resolve correctly.

ALTER TABLE nasiona       ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE nawozy_slownik ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE odbiorcy      ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
