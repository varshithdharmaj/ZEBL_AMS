-- AlterEnum
-- Spare RecruitmentPipelineStage values for recruiter-added pipeline columns.
-- Every job is seeded with all the named stages, so "Add Stage" had no free
-- value left and always failed with "maximum number of pipeline stages".
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
