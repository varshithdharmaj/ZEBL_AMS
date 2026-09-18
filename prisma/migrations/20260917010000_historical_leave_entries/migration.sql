-- HR-backfilled historical leave entries (date range + reason), separate from
-- the plain balance-number "manual adjustment" toggle added earlier. A backfilled
-- entry is created already-approved (no approval-step workflow) since it records
-- something that already happened. Correcting one never rewrites it in place —
-- see LeaveRequest.previousRequestId ("reverse and recreate").

-- AlterTable
ALTER TABLE "leave_policy_settings"
  ADD COLUMN "allow_historical_leave_entry" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allow_historical_leave_edit" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "leave_requests"
  ADD COLUMN "is_historical_entry" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "previous_request_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_previous_request_id_key" ON "leave_requests"("previous_request_id");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_previous_request_id_fkey" FOREIGN KEY ("previous_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
