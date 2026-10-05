import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruitmentPipelineStage, StageCategory } from "@/generated/prisma/enums";
import { createPipelineStageService } from "@/lib/recruitment/job/pipeline-stage-service";
import type { JobRepository, JobOpeningDetail, JobOpeningStageView } from "@/lib/recruitment/job/types";
import type { SessionUser } from "@/lib/session";
import {
  CUSTOM_STAGE_SLOTS,
  DEFAULT_STAGE_SEED_ORDER,
  INSERTABLE_STAGE_POOL,
  PIPELINE_STAGE_LABELS,
  SYSTEM_STAGE_VALUES,
} from "@/lib/recruitment/shared/pipeline-stage-groups";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) => work({}),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: { append: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: { RECRUITMENT_JOB_STAGE_ADDED: "recruitment.job.stage_added" },
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

function stage(value: RecruitmentPipelineStage, index: number): JobOpeningStageView {
  return {
    id: `st-${index}`,
    jobOpeningId: "job-1",
    stage: value,
    category: StageCategory.INTERVIEW,
    sortOrder: (index + 1) * 10,
    isOptional: false,
    isEnabled: true,
    isArchived: false,
    label: PIPELINE_STAGE_LABELS[value],
    slaDays: null,
  };
}

function jobWith(stages: JobOpeningStageView[]): JobOpeningDetail {
  return { id: "job-1", deletedAt: null, stages } as unknown as JobOpeningDetail;
}

describe("pipeline stage slots", () => {
  let repo: JobRepository;

  beforeEach(() => {
    repo = {
      getJob: vi.fn(),
      insertJobStage: vi.fn(async () => ({ id: "st-new" })),
    } as unknown as JobRepository;
  });

  it("keeps 12 spare slots after the named stages, none of them reserved", () => {
    expect(CUSTOM_STAGE_SLOTS).toHaveLength(12);
    expect(INSERTABLE_STAGE_POOL.slice(-12)).toEqual([...CUSTOM_STAGE_SLOTS]);
    expect(CUSTOM_STAGE_SLOTS.some((s) => SYSTEM_STAGE_VALUES.has(s))).toBe(false);
    expect(DEFAULT_STAGE_SEED_ORDER.some((s) => (CUSTOM_STAGE_SLOTS as readonly string[]).includes(s))).toBe(false);
  });

  it("adds a stage to a job that already has every default stage", async () => {
    (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
      jobWith(DEFAULT_STAGE_SEED_ORDER.map(stage))
    );

    const result = await createPipelineStageService(repo).createStage(hrSession, {
      jobOpeningId: "job-1",
      label: "CEO Round",
      category: StageCategory.INTERVIEW,
    });

    expect(result.id).toBe("st-new");
    expect(repo.insertJobStage).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ label: "CEO Round", stage: RecruitmentPipelineStage.custom_1 }),
      expect.anything()
    );
  });

  it("still refuses once every slot is taken", async () => {
    (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
      jobWith(INSERTABLE_STAGE_POOL.map(stage))
    );

    await expect(
      createPipelineStageService(repo).createStage(hrSession, {
        jobOpeningId: "job-1",
        label: "One More",
        category: StageCategory.SCREENING,
      })
    ).rejects.toMatchObject({ code: "REC_PRECONDITION" });
    expect(repo.insertJobStage).not.toHaveBeenCalled();
  });
});
