-- Auto-LOP on balance exhaustion: a leave request no longer has to be
-- entirely payable. `lop_days` is the subset of `days` that is unpaid
-- (Loss of Pay), computed at submission time instead of hard-rejecting
-- the request when balance is insufficient. DEFAULT 0 correctly backfills
-- every historical row, which was created under the old hard-block rule.
ALTER TABLE "leave_requests" ADD COLUMN "lop_days" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Informational-only mirror of leave_days on the payroll summary snapshot,
-- for manual payroll review. No automatic salary deduction is computed —
-- this module has no per-day wage-rate concept.
ALTER TABLE "payroll_attendance_summaries" ADD COLUMN "lop_days" DOUBLE PRECISION NOT NULL DEFAULT 0;
