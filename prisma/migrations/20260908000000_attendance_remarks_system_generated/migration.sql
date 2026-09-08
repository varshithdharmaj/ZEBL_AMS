-- Distinguishes internal/technical remarks (e.g. "Biometric Device Ingestion",
-- "Live check-in") written by ingestion/derivation pipelines from human-authored
-- remarks, so employee-facing UI can hide the former and keep showing the latter.
ALTER TABLE "attendance_records" ADD COLUMN "remarks_system_generated" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing row already carries one of these exact internal tags
-- written by the ingestion/derivation pipelines before this column existed. Only
-- newly-written rows would otherwise get the flag, leaving every historical row
-- (i.e. everything that exists today) showing its raw system tag in the tooltip.
UPDATE "attendance_records"
SET "remarks_system_generated" = true
WHERE "remarks" IN ('Biometric Device Ingestion', 'Live check-in', 'HR Regularised');
