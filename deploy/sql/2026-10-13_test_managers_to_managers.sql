-- Test manager accounts become ordinary managers: they lose the full
-- Recruitment workspace (recruitment_ops_access) and instead see only the
-- hiring batches HR shares with them (Hiring in their menu).
-- Run on the production database in pgAdmin AFTER deploying the batch
-- sharing code (2026-10-13_hiring_batch_managers.sql must already be run).
--
-- Changes one column on at most two rows. Safe to run more than once.
-- To undo: run the same UPDATE with "= true".

BEGIN;

UPDATE "users"
SET "recruitment_ops_access" = false
WHERE "email" IN ('mgr1.test@zebl.local', 'mgr2.test@zebl.local')
  AND "recruitment_ops_access" = true;

COMMIT;

-- Check (both rows should show false):
-- SELECT "email", "role", "recruitment_ops_access" FROM "users"
-- WHERE "email" IN ('mgr1.test@zebl.local', 'mgr2.test@zebl.local');
