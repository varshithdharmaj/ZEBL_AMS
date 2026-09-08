-- Shift master data, configured by Super Admin (Shift Management settings page).
-- `Employee.shift` remains a free-text string with no FK to this table by design
-- (existing employee assignments are not migrated onto it).
CREATE TABLE "shifts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 0,
    "expected_work_minutes" INTEGER NOT NULL DEFAULT 480,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shifts_name_key" ON "shifts"("name");
