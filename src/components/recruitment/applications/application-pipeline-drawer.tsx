"use client";

import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import type { HiringDecisionRecord } from "@/lib/recruitment/repositories/decision-repository";
import type { CandidateTagView } from "@/components/recruitment/applications/candidate-tags-input";
import type { StageOption } from "@/lib/recruitment/shared/next-stage";
import type { CandidateFacts } from "@/lib/recruitment/batch/batch-service";
import { CandidateReviewPanel } from "@/components/recruitment/applications/candidate-review-panel";

/** Non-terminal, non-system-owned stages — reused by the bulk "Move Stage" action too. */
export const STAGE_OPTIONS: RecruitmentPipelineStage[] = [
  RecruitmentPipelineStage.resume_received,
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.offer,
  RecruitmentPipelineStage.decision,
];

export type PipelineDrawerFeedback = {
  id: string;
  authorName: string;
  interviewTitle: string;
  submittedAt: Date | string | null;
  ratingsJson: unknown;
  recommendation: string | null;
  consideredForPosition: boolean | null;
  overallRating: number | null;
  strengths: string | null;
  concerns: string | null;
  privateNotes: string | null;
  /** The interview round ("hr", "manager", ...), so the panel can find your own HR or Manager rating. */
  roundType?: string | null;
  /** Written by the person viewing. */
  mine?: boolean;
};

export type PipelineDrawerApplication = {
  id: string;
  currentStage: RecruitmentPipelineStage | string;
  /** The job's own name for `currentStage`, when known. */
  currentStageLabel?: string | null;
  status: string;
  rejectedReason?: string | null;
  rejectionReasonCode?: string | null;
  withdrawnReason?: string | null;
  withdrawalReasonCode?: string | null;
  stageEnteredAt?: Date | string | null;
  source?: string | null;
  recruiterName?: string | null;
  /** The job's own stage order and names (falls back to the default order). */
  stageOptions?: StageOption[];
  resume?: { id: string; fileName: string; mimeType: string | null } | null;
  feedback?: PipelineDrawerFeedback[];
  priority?: string | null;
  createdAt: Date | string;
  candidate: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    totalExperienceYears?: number | string | null;
    currentCompany?: string | null;
    location?: string | null;
    noticePeriodDays?: number | null;
  };
  tags?: CandidateTagView[];
  jobOpening: {
    id: string;
    title: string;
  };
  interviews?: Array<{
    id: string;
    title: string;
    scheduledStart: Date | string;
    status: string;
  }>;
  offers?: Array<{
    id: string;
    offerNumber?: string | null;
    status: string;
    ctc?: number | string | null;
    negotiationStatus?: string | null;
    negotiationNote?: string | null;
    negotiationFollowUpAt?: Date | string | null;
  }>;
  stageHistory?: Array<{
    id: string;
    toStage?: string | null;
    fromStage?: string | null;
    createdAt: Date | string;
    note?: string | null;
    actorEmail?: string | null;
  }>;
  assessment?: string | null;
  assessmentUpdatedAt?: Date | string | null;
  assessmentUpdatedByEmail?: string | null;
  currentDecision?: HiringDecisionRecord | null;
  requireDecisionForOffer?: boolean;
  /** False when the viewer's login has no employee profile: scorecards need one. */
  viewerCanRate?: boolean;
  /** What the candidate panel shows: experience, CTC, stars and so on. */
  facts?: CandidateFacts | null;
};

export type PipelineDrawerTab = "overview" | "resume" | "feedback" | "activity";

/** The Pipeline's candidate panel: the same panel as on Batches. */
export function ApplicationPipelineDrawer({
  application,
  open,
  onClose,
  prevId,
  nextId,
  onNavigate,
}: {
  application: PipelineDrawerApplication | null;
  open: boolean;
  onClose: () => void;
  /** Neighbouring candidates in the same column, for ‹ › and J/K. */
  prevId?: string | null;
  nextId?: string | null;
  onNavigate?: (id: string) => void;
  /** Kept for callers; the panel has one view. */
  initialTab?: PipelineDrawerTab;
}) {
  return (
    <CandidateReviewPanel
      facts={null}
      application={application}
      open={open}
      onClose={onClose}
      prevId={prevId ?? null}
      nextId={nextId ?? null}
      onNavigate={onNavigate}
    />
  );
}
