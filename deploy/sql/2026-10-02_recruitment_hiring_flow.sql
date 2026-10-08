-- Recruitment hiring flow: star scorecard, reject/withdraw reasons, offer
-- negotiation and scorecard reminders. Run once on the production database in
-- pgAdmin, BEFORE deploying this code and before syncing new recruitment rows.
--
-- Safe to run more than once. Adds nullable columns only; no existing table
-- or row is read, changed or deleted.
-- Mirrors these Prisma migrations:
--   20260929000000_interview_feedback_considered_for_position
--   20261001000000_application_close_reason_codes
--   20261002000000_offer_negotiation_tracking
--   20261002010000_interview_panelist_feedback_reminder

BEGIN;

-- Scorecard: the "can be considered for the position" Yes/No.
ALTER TABLE "interview_feedback"
  ADD COLUMN IF NOT EXISTS "considered_for_position" BOOLEAN;

-- Reject / withdraw: reason picked from a list (the old text column is the note).
ALTER TABLE "recruitment_applications"
  ADD COLUMN IF NOT EXISTS "rejection_reason_code" TEXT,
  ADD COLUMN IF NOT EXISTS "withdrawal_reason_code" TEXT;

-- Offers: decline reason from a list, and negotiation tracking.
ALTER TABLE "recruitment_offers"
  ADD COLUMN IF NOT EXISTS "decline_reason_code" TEXT,
  ADD COLUMN IF NOT EXISTS "negotiation_status" TEXT,
  ADD COLUMN IF NOT EXISTS "negotiation_note" TEXT,
  ADD COLUMN IF NOT EXISTS "negotiation_follow_up_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "negotiation_updated_at" TIMESTAMP(3);

-- Missing-scorecard reminders: once a day per interview.
ALTER TABLE "interview_panelists"
  ADD COLUMN IF NOT EXISTS "feedback_reminder_sent_at" TIMESTAMP(3);

COMMIT;

-- Check (expect 9 rows):
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE (table_name, column_name) IN (
--   ('interview_feedback', 'considered_for_position'),
--   ('recruitment_applications', 'rejection_reason_code'),
--   ('recruitment_applications', 'withdrawal_reason_code'),
--   ('recruitment_offers', 'decline_reason_code'),
--   ('recruitment_offers', 'negotiation_status'),
--   ('recruitment_offers', 'negotiation_note'),
--   ('recruitment_offers', 'negotiation_follow_up_at'),
--   ('recruitment_offers', 'negotiation_updated_at'),
--   ('interview_panelists', 'feedback_reminder_sent_at'));
