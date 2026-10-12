import { describe, expect, it } from "vitest";
import { RecruitmentPipelineStage as S } from "@/generated/prisma/enums";
import { buildBoardLayout, customStagesInLayout } from "@/lib/recruitment/shared/board-layout";

const seed = [
  S.resume_received, S.screening, S.assessment, S.hr_round, S.technical_round, S.team_lead_round,
  S.manager_round, S.client_round, S.reference_check, S.decision, S.offer, S.hired,
].map((stage, i) => ({ id: `row-${stage}`, stage, sortOrder: (i + 1) * 10, isEnabled: true }));

describe("buildBoardLayout", () => {
  it("shows the five paper-plan groups for a job with no extra columns", () => {
    const layout = buildBoardLayout(seed);
    expect(layout.map((e) => (e.kind === "group" ? e.groupId : e.label))).toEqual([
      "hr_round", "manager_round", "hire", "reject", "hold",
    ]);
    const manager = layout[1];
    expect(manager).toMatchObject({ firstRowId: "row-technical_round", lastRowId: "row-reference_check" });
  });

  it("puts an Add stage column where HR placed it", () => {
    const rows = [...seed, { id: "row-call", stage: S.custom_1, label: "Client call", sortOrder: 95, isEnabled: true }];
    const layout = buildBoardLayout(rows);
    expect(layout.map((e) => (e.kind === "group" ? e.groupId : e.label))).toEqual([
      "hr_round", "manager_round", "Client call", "hire", "reject", "hold",
    ]);
    expect([...customStagesInLayout(layout)]).toEqual([S.custom_1]);
  });

  it("leaves out archived and switched-off columns", () => {
    const rows = [
      ...seed,
      { id: "row-old", stage: S.custom_2, label: "Old", sortOrder: 95, isArchived: true },
      { id: "row-off", stage: S.custom_3, label: "Off", sortOrder: 96, isEnabled: false },
    ];
    expect(buildBoardLayout(rows).some((e) => e.kind === "custom")).toBe(false);
  });
});
