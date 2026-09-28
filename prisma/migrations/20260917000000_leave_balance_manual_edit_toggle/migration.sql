-- Super Admin/HR toggle: while true, HR can manually set/adjust an employee's
-- leave balance from their profile — needed to seed opening balances when
-- migrating off a manual/paper system, then switched off once migration is
-- complete. Defaults to true so existing deployments keep working as-is.

-- AlterTable
ALTER TABLE "leave_policy_settings" ADD COLUMN "allow_manual_leave_balance_adjustments" BOOLEAN NOT NULL DEFAULT true;
