-- HR bulk "opening balance" leave migration (Excel -> HRMS). One row per
-- import run; every LeaveTransaction written by that run links back here via
-- import_batch_id, so a whole migration can be audited/investigated as a unit.
-- Additive only: new table + a nullable FK column, no existing data touched.

-- CreateTable
CREATE TABLE "leave_balance_import_batches" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balance_import_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "leave_transactions" ADD COLUMN "import_batch_id" INTEGER;

-- CreateIndex
CREATE INDEX "leave_transactions_import_batch_id_idx" ON "leave_transactions"("import_batch_id");

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "leave_balance_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
