-- CreateTable
CREATE TABLE "recruitment_hiring_batch_managers" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitment_hiring_batch_managers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_hiring_batch_managers_batch_id_user_id_key" ON "recruitment_hiring_batch_managers"("batch_id", "user_id");

-- CreateIndex
CREATE INDEX "recruitment_hiring_batch_managers_user_id_idx" ON "recruitment_hiring_batch_managers"("user_id");

-- AddForeignKey
ALTER TABLE "recruitment_hiring_batch_managers" ADD CONSTRAINT "recruitment_hiring_batch_managers_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "recruitment_hiring_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_hiring_batch_managers" ADD CONSTRAINT "recruitment_hiring_batch_managers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
