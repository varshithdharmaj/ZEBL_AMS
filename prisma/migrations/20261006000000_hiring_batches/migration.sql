-- Hiring batches: HR groups candidates into a batch (Batch ID B-2026-001),
-- usually one interview date per batch. Additive only.

-- CreateEnum
CREATE TYPE "HiringBatchStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "recruitment_hiring_batches" (
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

-- CreateTable
CREATE TABLE "recruitment_hiring_batch_members" (
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

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_hiring_batches_code_key" ON "recruitment_hiring_batches"("code");
CREATE INDEX "recruitment_hiring_batches_status_deleted_at_idx" ON "recruitment_hiring_batches"("status", "deleted_at");
CREATE INDEX "recruitment_hiring_batches_created_at_idx" ON "recruitment_hiring_batches"("created_at");
CREATE INDEX "recruitment_hiring_batch_members_application_id_idx" ON "recruitment_hiring_batch_members"("application_id");
CREATE UNIQUE INDEX "recruitment_hiring_batch_members_batch_id_application_id_key" ON "recruitment_hiring_batch_members"("batch_id", "application_id");

-- AddForeignKey
ALTER TABLE "recruitment_hiring_batches" ADD CONSTRAINT "recruitment_hiring_batches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_hiring_batch_members" ADD CONSTRAINT "recruitment_hiring_batch_members_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "recruitment_hiring_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_hiring_batch_members" ADD CONSTRAINT "recruitment_hiring_batch_members_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "recruitment_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_hiring_batch_members" ADD CONSTRAINT "recruitment_hiring_batch_members_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
