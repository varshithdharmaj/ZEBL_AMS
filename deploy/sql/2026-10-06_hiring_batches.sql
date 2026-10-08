-- Hiring batches: HR groups candidates into a batch (Batch ID B-2026-001)
-- usually one interview date per batch.
-- Run once on the production database in pgAdmin, BEFORE deploying this code.
--
-- Safe to run more than once. Only creates a new enum and two new tables, and
-- adds interview_date if an earlier copy of this script already ran;
-- no other table or row is read, changed or deleted.
-- Mirrors this Prisma migration:
--   20261006000000_hiring_batches

BEGIN;

DO $$ BEGIN
  CREATE TYPE "HiringBatchStatus" AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "recruitment_hiring_batches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "interview_date" DATE,
    "status" "HiringBatchStatus" NOT NULL DEFAULT 'open',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "recruitment_hiring_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recruitment_hiring_batch_members" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "sl_no" INTEGER NOT NULL,
    "remarks" TEXT,
    "added_by_user_id" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recruitment_hiring_batch_members_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recruitment_hiring_batches" ADD COLUMN IF NOT EXISTS "interview_date" DATE;

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_hiring_batches_code_key" ON "recruitment_hiring_batches"("code");
CREATE INDEX IF NOT EXISTS "recruitment_hiring_batches_status_deleted_at_idx" ON "recruitment_hiring_batches"("status", "deleted_at");
CREATE INDEX IF NOT EXISTS "recruitment_hiring_batches_created_at_idx" ON "recruitment_hiring_batches"("created_at");
CREATE INDEX IF NOT EXISTS "recruitment_hiring_batch_members_application_id_idx" ON "recruitment_hiring_batch_members"("application_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_hiring_batch_members_batch_id_application_id_key" ON "recruitment_hiring_batch_members"("batch_id", "application_id");

DO $$ BEGIN
  ALTER TABLE "recruitment_hiring_batches" ADD CONSTRAINT "recruitment_hiring_batches_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recruitment_hiring_batch_members" ADD CONSTRAINT "recruitment_hiring_batch_members_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "recruitment_hiring_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recruitment_hiring_batch_members" ADD CONSTRAINT "recruitment_hiring_batch_members_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "recruitment_hiring_batch_members" ADD CONSTRAINT "recruitment_hiring_batch_members_added_by_user_id_fkey"
    FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- Check (expect 2 tables, 0 rows each on first run):
-- SELECT 'batches' AS t, count(*) FROM "recruitment_hiring_batches"
-- UNION ALL SELECT 'members', count(*) FROM "recruitment_hiring_batch_members";
