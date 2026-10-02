import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { DEFAULT_STAGE_SEED_ORDER, PIPELINE_STAGE_LABELS } from "./pipeline-stage-groups";

export type StageOption = { stage: RecruitmentPipelineStage; label: string };

type JobStageLike = {
  stage: RecruitmentPipelineStage;
  label?: string | null;
  sortOrder: number;
  isEnabled?: boolean;
  isArchived?: boolean;
};

/**
 * Stages a recruiter can move an application into by hand. "Joined" is set
 * only by Convert to Employee; rejected / on hold / withdrawn have their own
 * actions with reasons.
 */
const NOT_MOVABLE: ReadonlySet<RecruitmentPipelineStage> = new Set([
  RecruitmentPipelineStage.hired,
  RecruitmentPipelineStage.rejected,
  RecruitmentPipelineStage.on_hold,
  RecruitmentPipelineStage.withdrawn,
]);

/** The job's own stage order and names, or the default order when the job has none. */
export function movableStageOptions(jobStages?: readonly JobStageLike[] | null): StageOption[] {
  const usable = (jobStages ?? []).filter(
    (s) => s.isEnabled !== false && !s.isArchived && !NOT_MOVABLE.has(s.stage)
  );
  if (usable.length > 0) {
    return [...usable]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ stage: s.stage, label: s.label?.trim() || PIPELINE_STAGE_LABELS[s.stage] }));
  }
  return DEFAULT_STAGE_SEED_ORDER.filter((s) => !NOT_MOVABLE.has(s)).map((stage) => ({
    stage,
    label: PIPELINE_STAGE_LABELS[stage],
  }));
}

/** The stage after `current` in that order, or null at the end / for closed applications. */
export function nextStageAfter(
  current: RecruitmentPipelineStage | string,
  options: readonly StageOption[]
): StageOption | null {
  const index = options.findIndex((o) => o.stage === current);
  if (index === -1) return null;
  return options[index + 1] ?? null;
}

export function stageLabel(
  stage: RecruitmentPipelineStage | string,
  options?: readonly StageOption[]
): string {
  return (
    options?.find((o) => o.stage === stage)?.label ??
    PIPELINE_STAGE_LABELS[stage as RecruitmentPipelineStage] ??
    String(stage).replace(/_/g, " ")
  );
}
