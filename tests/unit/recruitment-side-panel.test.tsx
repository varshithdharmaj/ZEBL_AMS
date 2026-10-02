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
vi.mock("@/components/recruitment/applications/application-assessment-form", () => ({
  ApplicationAssessmentForm: () => null,
}));
vi.mock("@/components/recruitment/applications/hiring-decision-form", () => ({
  HiringDecisionForm: () => null,
}));
vi.mock("@/components/recruitment/applications/candidate-tags-input", () => ({
  CandidateTagsInput: () => null,
}));

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

  it("leads with stage, time in stage, owner and the next-stage button", () => {
    const html = render();
    expect(html).toContain(">Applied<");
    expect(html).toContain("3 days in stage");
    expect(html).toContain("Owner: Sowmya");
    expect(html).toMatch(/Move to (<!-- -->)?Phone screen/);
    expect(html).toContain("Reject");
    expect(html).toContain("Previous candidate (K)");
  });

  it("hides blank details and offers the resume", () => {
    const html = render();
    expect(html).toContain("Hyderabad");
    expect(html).not.toContain("Notice Period");
    expect(html).toContain("Review the resume, then move on or reject");
    expect(html).toContain("View resume");
  });

  it("warns when a decision exists without any scorecards", () => {
    const html = render({
      currentStage: S.decision,
      currentDecision: { outcome: "strong_hire" },
      feedback: [],
      interviews: [],
    });
    expect(html).toContain("no interviewer has submitted a scorecard");
    expect(html).toContain("No interviews are on record");
  });

  it("asks to schedule when an interview round has nothing booked", () => {
    const html = render({ currentStage: S.technical_round, interviews: [] });
    expect(html).toContain("Schedule the interview for this round");
  });

  it("shows no move/reject actions for a rejected application", () => {
    const html = render({ status: "rejected", currentStage: S.rejected, rejectionReasonCode: "failed_interview" });
    expect(html).not.toContain("Move to");
    expect(html).toContain("Failed interview round");
  });
});
