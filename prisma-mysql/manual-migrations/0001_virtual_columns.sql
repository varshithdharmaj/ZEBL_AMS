-- Run AFTER `prisma migrate deploy --schema=prisma-mysql/schema.prisma` (or
-- `prisma db push`) has created attendance_sessions.open_attendance_id and
-- leave_transactions.system_accrual_key as plain nullable columns.
--
-- Prisma's schema DSL has no syntax for MySQL GENERATED ALWAYS AS (...) VIRTUAL
-- columns, so those two fields are declared as ordinary nullable columns in
-- prisma-mysql/schema.prisma (see comments on AttendanceSession.openAttendanceId
-- and LeaveTransaction.systemAccrualKey) and converted into real generated
-- columns here, by hand, exactly once. Prisma migrate will never see this file
-- and will never try to "fix" these columns back to plain ones, because the
-- schema.prisma fields are deliberately NOT marked @unique — only this SQL
-- creates the unique indexes, mirroring the existing PostgreSQL convention of
-- hand-written partial-unique-index migrations (see e.g.
-- prisma/migrations/20260811140000_leave_transaction_idempotency/migration.sql).
--
-- Idempotent: safe to re-run.

-- 1. attendance_sessions: at most one OPEN (check_out IS NULL) session per
--    attendance day. Replicates Postgres "attendance_sessions_one_open_per_day_idx".
ALTER TABLE `attendance_sessions`
  DROP COLUMN IF EXISTS `open_attendance_id`;

ALTER TABLE `attendance_sessions`
  ADD COLUMN `open_attendance_id` INT
    GENERATED ALWAYS AS (IF(`check_out` IS NULL, `attendance_id`, NULL)) VIRTUAL;

CREATE UNIQUE INDEX `attendance_sessions_open_attendance_id_key`
  ON `attendance_sessions` (`open_attendance_id`);

-- 2. leave_transactions: idempotent system accruals — at most one row per
--    (employee_id, reason) among rows where transaction_type IN ('accrual',
--    'expiry') AND leave_request_id IS NULL AND reason IS NOT NULL.
--    Replicates Postgres "leave_transactions_system_accrual_reason_uidx".
--    (The sibling constraint — one ledger row per (leave_request_id,
--    transaction_type) — needed no generated column; it's a plain @@unique
--    in schema.prisma, since MySQL treats every NULL as distinct just like
--    Postgres does.)
ALTER TABLE `leave_transactions`
  DROP COLUMN IF EXISTS `system_accrual_key`;

ALTER TABLE `leave_transactions`
  ADD COLUMN `system_accrual_key` VARCHAR(160)
    GENERATED ALWAYS AS (
      IF(
        `transaction_type` IN ('accrual', 'expiry')
          AND `leave_request_id` IS NULL
          AND `reason` IS NOT NULL,
        CONCAT(`employee_id`, ':', `reason`),
        NULL
      )
    ) VIRTUAL;

CREATE UNIQUE INDEX `leave_transactions_system_accrual_key_key`
  ON `leave_transactions` (`system_accrual_key`);
