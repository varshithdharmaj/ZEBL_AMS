-- Late Arrival -> Auto Half-Day policy: Super Admin toggle that converts
-- repeated late arrivals (beyond a shift's grace period) into an automatic
-- half-day leave deduction. See src/lib/attendance/late-arrival-policy.ts.
-- `enabled_at` is the hard cutoff evaluation never looks before — turning this
-- on never rewrites past attendance/leave history.

-- CreateTable
CREATE TABLE "late_arrival_policy_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "free_lates_per_month" INTEGER NOT NULL DEFAULT 2,
    "enabled_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "late_arrival_policy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "late_arrival_penalties" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "attendance_date" TIMESTAMP(3) NOT NULL,
    "month_key" TEXT NOT NULL,
    "occurrence_in_month" INTEGER NOT NULL,
    "free_lates_allowed" INTEGER NOT NULL,
    "triggered_half_day" BOOLEAN NOT NULL DEFAULT false,
    "leave_request_id" INTEGER,
    "reversed_at" TIMESTAMP(3),
    "reversed_by_regularization_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_arrival_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "late_arrival_penalties_employee_id_attendance_date_key" ON "late_arrival_penalties"("employee_id", "attendance_date");

-- CreateIndex
CREATE INDEX "late_arrival_penalties_employee_id_month_key_idx" ON "late_arrival_penalties"("employee_id", "month_key");

-- AddForeignKey
ALTER TABLE "late_arrival_penalties" ADD CONSTRAINT "late_arrival_penalties_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
