import type { ApplicationDetail } from "@/lib/recruitment/repositories/application-repository";
import { pipelineStageLabel } from "@/lib/recruitment/shared/pipeline-stage-groups";

export type CandidateWorkspaceApplicationRow = {
  id: string;
  status: string;
  currentStage: string;
  /** The job's own name for `currentStage`. */
  currentStageLabel: string;
  jobOpeningId: string;
  jobTitle: string;
  createdAt: Date | string;
};

export function mapWorkspaceApplicationRow(
  item: ApplicationDetail | Record<string, unknown>
): CandidateWorkspaceApplicationRow {
  const jobOpening = (item as { jobOpening?: { id?: string; title?: string } }).jobOpening;
  const currentStage = String((item as { currentStage?: string }).currentStage ?? "");
  const stageRefLabel = (item as { currentStageRef?: { label?: string | null } | null }).currentStageRef
    ?.label;
  return {
    id: String(item.id),
    status: String((item as { status?: string }).status ?? ""),
    currentStage,
    currentStageLabel: stageRefLabel?.trim() || pipelineStageLabel(currentStage),
    jobOpeningId: String(
      (item as { jobOpeningId?: string }).jobOpeningId ?? jobOpening?.id ?? ""
    ),
    jobTitle: String(jobOpening?.title ?? "Job"),
    createdAt: (item as { createdAt: Date | string }).createdAt,
  };
}
