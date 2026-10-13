-- Share hiring batches with managers: one new table, which manager can see
-- which batch. Run once on the production database in pgAdmin, AFTER
-- 2026-10-06_hiring_batches.sql and BEFORE deploying this code.
--
-- Safe to run more than once. Only creates one new table with its indexes
-- and keys; no other table or row is read, changed or deleted.
-- Mirrors this Prisma migration:
--   20261013000000_hiring_batch_managers

BEGIN;

CREATE TABLE IF NOT EXISTS "recruitment_hiring_batch_managers" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recruitment_hiring_batch_managers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_hiring_batch_managers_batch_id_user_id_key"
  ON "recruitment_hiring_batch_managers"("batch_id", "user_id");
CREATE INDEX IF NOT EXISTS "recruitment_hiring_batch_managers_user_id_idx"
  ON "recruitment_hiring_batch_managers"("user_id");

DO $$ BEGIN
  ALTER TABLE "recruitment_hiring_batch_managers"
    ADD CONSTRAINT "recruitment_hiring_batch_managers_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "recruitment_hiring_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recruitment_hiring_batch_managers"
    ADD CONSTRAINT "recruitment_hiring_batch_managers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- Check (should return 1 row):
-- SELECT to_regclass('public.recruitment_hiring_batch_managers');
