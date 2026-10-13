import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { movableStageOptions, nextStageAfter, stageLabel } from "@/lib/recruitment/shared/next-stage";

const mockFeedbackFindMany = vi.fn();
const mockOfferFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    interviewFeedback: { findMany: (...a: unknown[]) => mockFeedbackFindMany(...a) },
    offer: { findMany: (...a: unknown[]) => mockOfferFindMany(...a) },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/recruitment/pipeline",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/actions/recruitment-applications", () => ({
  moveApplicationStageAction: vi.fn(),
  rejectApplicationAction: vi.fn(),
  withdrawApplicationAction: vi.fn(),
}));
vi.mock("@/actions/recruitment-decisions", () => ({ markHireAction: vi.fn() }));
vi.mock("@/actions/recruitment-batches", () => ({ removeBatchMembersAction: vi.fn() }));

import { loadApplicationScoreSummaries } from "@/lib/recruitment/interview/score-summaries";
import { ApplicationPipelineDrawer } from "@/components/recruitment/applications/application-pipeline-drawer";

const S = RecruitmentPipelineStage;

describe("next stage", () => {
  const jobStages = [
    { stage: S.resume_received, sortOrder: 0, label: "Applied" },
    { stage: S.hr_round, sortOrder: 1, label: "HR call" },
    { stage: S.technical_round, sortOrder: 2, label: null, isEnabled: false },
    { stage: S.client_round, sortOrder: 3, label: "Client round" },
    { stage: S.offer, sortOrder: 4, label: null },
    { stage: S.hired, sortOrder: 5, label: null },
    { stage: S.rejected, sortOrder: 6, label: null },
  ];
  const options = movableStageOptions(jobStages);

  it("follows the job's own order and names, skipping disabled and closing stages", () => {
    expect(options.map((o) => o.label)).toEqual(["Applied", "HR call", "Client round", "Offer"]);
  });

  it("finds the next stage", () => {
    expect(nextStageAfter(S.resume_received, options)?.label).toBe("HR call");
    expect(nextStageAfter(S.hr_round, options)?.label).toBe("Client round");
  });

  it("has no next stage at the end or for closed applications", () => {
    expect(nextStageAfter(S.offer, options)).toBeNull();
    expect(nextStageAfter(S.rejected, options)).toBeNull();
  });

  it("falls back to the default order when a job has no stages", () => {
    const fallback = movableStageOptions(null);
    expect(fallback[0].stage).toBe(S.resume_received);
    expect(fallback.some((o) => o.stage === S.hired)).toBe(false);
    expect(stageLabel(S.hr_round, options)).toBe("HR call");
  });
});

describe("list score columns", () => {
  it("averages stars and counts verdicts per application in one query", async () => {
    mockFeedbackFindMany.mockResolvedValueOnce([
      { interview: { applicationId: "a1" }, ratingsJson: { process_knowledge: 4, skills: 3, communication: 5 }, recommendation: "yes", consideredForPosition: true },
      { interview: { applicationId: "a1" }, ratingsJson: { process_knowledge: 2, skills: 3, communication: 4 }, recommendation: "strong_no", consideredForPosition: false },
      { interview: { applicationId: "a2" }, ratingsJson: {}, recommendation: "hire", consideredForPosition: true },
    ]);
    mockOfferFindMany.mockResolvedValueOnce([
      { applicationId: "a1", status: "released" },
      { applicationId: "a1", status: "draft" },
    ]);
    const res = await loadApplicationScoreSummaries(["a1", "a2", "a3"]);
    expect(mockFeedbackFindMany).toHaveBeenCalledTimes(1);
    expect(res.a1.averages).toEqual({ process_knowledge: 3, skills: 3, communication: 4.5 });
    expect(res.a1.verdicts).toEqual({ yes: 1, strong_no: 1 });
    expect(res.a1.offer?.status).toBe("released");
    expect(res.a2.verdicts).toEqual({ yes: 1 });
    expect(res.a3).toEqual({ scorecards: 0, averages: {}, verdicts: {}, offer: null });
  });
});

describe("pipeline side panel", () => {
  const base = {
    id: "app-1",
    currentStage: S.resume_received,
    status: "active",
    createdAt: "2026-09-20T10:00:00Z",
    stageEnteredAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    source: "careers_page",
    recruiterName: "Sowmya",
    candidate: { id: "c1", fullName: "Ananya Reddy", email: "ananya@example.com", location: "Hyderabad" },
    jobOpening: { id: "j1", title: "Senior Medical Billing Specialist" },
    stageOptions: movableStageOptions([
      { stage: S.resume_received, sortOrder: 0, label: "Applied" },
      { stage: S.screening, sortOrder: 1, label: "Phone screen" },
    ]),
    resume: { id: "doc-1", fileName: "ananya.pdf", mimeType: "application/pdf" },
  };

  const render = (overrides: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <ApplicationPipelineDrawer
        open
        onClose={() => {}}
        application={{ ...base, ...overrides } as never}
        prevId="app-0"
        nextId="app-2"
        onNavigate={() => {}}
      />
    );

  it("shows the stage, days in it and the HR Round steps", () => {
    const html = render();
    expect(html).toContain(">HR Round<");
    expect(html).toMatch(/3 days/);
    expect(html).toContain("Send to Manager Round");
    expect(html).toContain("Reject");
    expect(html).toContain("Hold");
    expect(html).toContain("Previous (K)");
  });

  it("drops the assessment and decision forms and keeps the resume and comments", () => {
    const html = render();
    expect(html).not.toContain("Recruiter Assessment");
    expect(html).not.toContain("Hiring Decision");
    expect(html).toContain("Open in new tab");
    expect(html).toContain("Comments");
  });

  it("offers Hire in the Manager Round and Make offer once hired", () => {
    expect(render({ currentStage: S.manager_round })).toContain(">Hire<");
    expect(render({ currentStage: S.decision, offers: [] })).toContain("Make offer");
  });

  it("shows Reopen and the reason, not the steps, for a rejected application", () => {
    const html = render({ status: "rejected", currentStage: S.rejected, rejectionReasonCode: "failed_interview" });
    expect(html).not.toContain("Send to Manager Round");
    expect(html).toContain("Reopen");
    expect(html).toContain("Failed interview round");
  });
});
