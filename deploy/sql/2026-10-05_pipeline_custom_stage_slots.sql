-- Pipeline "Add Stage": spare stage values for recruiter-added columns.
-- Run once on the production database in pgAdmin, BEFORE deploying this code
-- and before syncing any recruitment rows that use a custom stage.
--
-- Safe to run more than once. Only adds enum values; no table or row is read,
-- changed or deleted. Run it as-is (no BEGIN/COMMIT around it).
-- Mirrors this Prisma migration:
--   20261005000000_pipeline_custom_stage_slots

ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_1';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_2';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_3';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_4';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_5';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_6';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_7';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_8';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_9';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_10';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_11';
ALTER TYPE "RecruitmentPipelineStage" ADD VALUE IF NOT EXISTS 'custom_12';

-- Check (expect 12):
-- SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
-- WHERE t.typname = 'RecruitmentPipelineStage' AND e.enumlabel LIKE 'custom\_%';
