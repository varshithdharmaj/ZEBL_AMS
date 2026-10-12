import type { Prisma } from "@/generated/prisma/client";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import {
  INTERVIEW_STAGES,
  INTERVIEWING_STAGE_FILTER,
  pipelineBoardColumnFilter,
} from "@/lib/recruitment/shared/pipeline-stage-groups";

const CLOSED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.rejected,
  ApplicationStatus.withdrawn,
  ApplicationStatus.on_hold,
];

/** Prisma `where` for pipeline `currentStage`, including paper-plan column ids. */
export function pipelineStageFilterWhere(currentStage: string): Prisma.ApplicationWhereInput {
  if (currentStage === INTERVIEWING_STAGE_FILTER) {
    return { currentStage: { in: [...INTERVIEW_STAGES] } };
  }

  const column = pipelineBoardColumnFilter(currentStage);
  if (!column) {
    return { currentStage: currentStage as RecruitmentPipelineStage };
  }

  if (column.id === "reject") {
    return {
      OR: [
        { status: { in: [ApplicationStatus.rejected, ApplicationStatus.withdrawn] } },
        { currentStage: { in: [...column.stages] } },
      ],
    };
  }

  if (column.id === "hold") {
    return {
      OR: [
        { status: ApplicationStatus.on_hold },
        { currentStage: RecruitmentPipelineStage.on_hold },
      ],
    };
  }

  if (column.id === "hire") {
    return {
      OR: [
        { status: ApplicationStatus.hired },
        {
          AND: [
            { status: { notIn: CLOSED_STATUSES } },
            { currentStage: { in: [...column.stages] } },
          ],
        },
      ],
    };
  }

  return {
    AND: [
      { status: { notIn: CLOSED_STATUSES } },
      { currentStage: { in: [...column.stages] } },
    ],
  };
}
