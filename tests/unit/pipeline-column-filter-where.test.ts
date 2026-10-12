import { describe, expect, it } from "vitest";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { pipelineStageFilterWhere } from "@/lib/recruitment/application/pipeline-column-filter-where";
import {
  INTERVIEW_STAGES,
  PIPELINE_BOARD_COLUMN_FILTERS,
} from "@/lib/recruitment/shared/pipeline-stage-groups";

const hr = PIPELINE_BOARD_COLUMN_FILTERS.find((c) => c.id === "hr_round")!;
const manager = PIPELINE_BOARD_COLUMN_FILTERS.find((c) => c.id === "manager_round")!;
const hire = PIPELINE_BOARD_COLUMN_FILTERS.find((c) => c.id === "hire")!;
const closed = [ApplicationStatus.rejected, ApplicationStatus.withdrawn, ApplicationStatus.on_hold];

describe("pipelineStageFilterWhere", () => {
  it("keeps the interviewing sentinel as any interview stage", () => {
    expect(pipelineStageFilterWhere("interviewing")).toEqual({
      currentStage: { in: [...INTERVIEW_STAGES] },
    });
  });

  it("keeps an exact stage that is not a board column id", () => {
    expect(pipelineStageFilterWhere("technical_round")).toEqual({
      currentStage: "technical_round",
    });
  });

  it("maps HR Round to live early stages only", () => {
    expect(pipelineStageFilterWhere("hr_round")).toEqual({
      AND: [{ status: { notIn: closed } }, { currentStage: { in: [...hr.stages] } }],
    });
  });

  it("maps Manager Round to live later rounds", () => {
    expect(pipelineStageFilterWhere("manager_round")).toEqual({
      AND: [{ status: { notIn: closed } }, { currentStage: { in: [...manager.stages] } }],
    });
  });

  it("maps Hire to hired status or a live hire stage", () => {
    expect(pipelineStageFilterWhere("hire")).toEqual({
      OR: [
        { status: ApplicationStatus.hired },
        {
          AND: [{ status: { notIn: closed } }, { currentStage: { in: [...hire.stages] } }],
        },
      ],
    });
  });

  it("maps Reject to rejected or withdrawn status or stage", () => {
    expect(pipelineStageFilterWhere("reject")).toEqual({
      OR: [
        { status: { in: [ApplicationStatus.rejected, ApplicationStatus.withdrawn] } },
        {
          currentStage: {
            in: [RecruitmentPipelineStage.rejected, RecruitmentPipelineStage.withdrawn],
          },
        },
      ],
    });
  });

  it("maps Hold to on-hold status or stage", () => {
    expect(pipelineStageFilterWhere("hold")).toEqual({
      OR: [
        { status: ApplicationStatus.on_hold },
        { currentStage: RecruitmentPipelineStage.on_hold },
      ],
    });
  });
});
