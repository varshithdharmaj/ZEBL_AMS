-- Error Log: creates app_error_logs for the admin Error Log page
-- (/admin/operations/errors). Run once on the production database in pgAdmin.
--
-- Safe to run more than once. Creates one new table and two indexes only;
-- no existing table or row is read, changed or deleted.
-- Mirrors prisma/migrations/20260930000000_app_error_logs/migration.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS "app_error_logs" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "error_name" TEXT,
    "stack" TEXT,
    "path" TEXT,
    "method" TEXT,
    "route_type" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "app_error_logs_ref_idx" ON "app_error_logs"("ref");
CREATE INDEX IF NOT EXISTS "app_error_logs_created_at_idx" ON "app_error_logs"("created_at");

-- If this database tracks Prisma migrations, record this one as applied so a
-- later `prisma migrate deploy` doesn't try to create the table again.
DO $$
BEGIN
  -- Dynamic SQL: a static reference to a missing table fails at parse time.
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
      SELECT gen_random_uuid()::text,
             '206afebba1446bd8a0a3ddab847301474c1a78cb28b86206e6c5b0ddcde10f85',
             now(), '20260930000000_app_error_logs', now(), 1
      WHERE NOT EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE "migration_name" = '20260930000000_app_error_logs'
      )
    $sql$;
  END IF;
END $$;

COMMIT;

-- Check (expect: 14 columns, then 0 rows until the first error is recorded):
-- SELECT count(*) FROM information_schema.columns WHERE table_name = 'app_error_logs';
-- SELECT ref, event, message, created_at FROM app_error_logs ORDER BY created_at DESC LIMIT 5;
