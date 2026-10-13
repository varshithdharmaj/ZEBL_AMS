import "server-only";

import type { SessionUser } from "@/lib/session";
import type { PipelineDrawerApplication } from "@/components/recruitment/applications/application-pipeline-drawer";
import { getApplicationCached } from "@/lib/recruitment/application/queries";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import { prisma } from "@/lib/prisma";
import type { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { movableStageOptions } from "@/lib/recruitment/shared/next-stage";
import { loadCandidateFacts } from "@/lib/recruitment/batch/batch-service";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";

function toPlainNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(typeof value === "object" ? String(value) : value);
  return Number.isFinite(n) ? n : null;
}

type JobDetail = Awaited<ReturnType<typeof prismaJobRepository.getJob>>;

/**
 * What the candidate panel shows for one application beyond its facts: the
 * job's stage order, offers, every round's scorecards, the resume and why it
 * was closed. Shared by the Pipeline and Batches. Returns null when the
 * application is missing or not visible.
 */
export async function loadPipelineDrawerApplication(
  session: SessionUser,
  applicationId: string,
  context: { jobDetail?: JobDetail } = {}
): Promise<PipelineDrawerApplication | null> {
  const [selectedDetail, offers, facts] = await Promise.all([
    getApplicationCached(session, applicationId).catch(() => null),
    prisma.offer.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        offerNumber: true,
        status: true,
        ctc: true,
        negotiationStatus: true,
        negotiationNote: true,
        negotiationFollowUpAt: true,
      },
    }),
    loadCandidateFacts(session, applicationId).catch(() => null),
  ]);
  if (!selectedDetail) return null;
  // Managers (shared batches) don't see offers or interviewers' notes meant for HR.
  const isHr = canAccessRecruitmentAdministration(session);

  const [selectedJob, selectedFeedback] = await Promise.all([
    context.jobDetail?.id === selectedDetail.jobOpeningId
      ? Promise.resolve(context.jobDetail)
      : prismaJobRepository.getJob(selectedDetail.jobOpeningId),
    prisma.interviewFeedback.findMany({
      where: { interview: { applicationId: selectedDetail.id } },
      include: {
        author: { select: { name: true } },
        interview: { select: { title: true, scheduledStart: true, roundType: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const selectedResume =
    selectedDetail.candidate?.documents
      ?.filter((d) => d.documentType === "resume")
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0] ?? null;

  return {
    id: String(selectedDetail.id),
    currentStage: selectedDetail.currentStage as RecruitmentPipelineStage,
    currentStageLabel: selectedDetail.currentStageRef?.label ?? null,
    status: String(selectedDetail.status),
    rejectedReason: selectedDetail.rejectedReason ?? null,
    rejectionReasonCode: selectedDetail.rejectionReasonCode ?? null,
    withdrawnReason: selectedDetail.withdrawnReason ?? null,
    withdrawalReasonCode: selectedDetail.withdrawalReasonCode ?? null,
    stageEnteredAt: selectedDetail.stageEnteredAt as Date | string,
    source: selectedDetail.source ?? null,
    stageOptions: movableStageOptions(selectedJob?.stages),
    resume: selectedResume
      ? { id: selectedResume.id, fileName: selectedResume.fileName, mimeType: selectedResume.mimeType }
      : null,
    feedback: selectedFeedback.map((f) => ({
      id: f.id,
      authorName: f.author.name,
      interviewTitle: f.interview.title ?? "Interview",
      submittedAt: f.submittedAt,
      ratingsJson: f.ratingsJson,
      recommendation: f.recommendation,
      consideredForPosition: f.consideredForPosition,
      overallRating: f.overallRating,
      strengths: f.strengths,
      concerns: f.concerns,
      privateNotes: isHr || (session.employeeId != null && f.authorEmployeeId === session.employeeId) ? f.privateNotes : null,
      roundType: f.interview.roundType,
      mine: session.employeeId != null && f.authorEmployeeId === session.employeeId,
    })),
    createdAt: selectedDetail.createdAt as Date | string,
    candidate: {
      id: String(selectedDetail.candidate?.id ?? ""),
      fullName: String(selectedDetail.candidate?.fullName ?? "Unknown"),
      email: selectedDetail.candidate?.email ?? null,
      phone: selectedDetail.candidate?.phone ?? null,
      // A Prisma Decimal can't be passed to the client panel; send a plain number.
      totalExperienceYears: toPlainNumber(
        (selectedDetail.candidate as { totalExperienceYears?: unknown } | null)?.totalExperienceYears
      ),
      location: (selectedDetail.candidate as { location?: string | null } | null)?.location ?? null,
    },
    jobOpening: {
      id: String(selectedDetail.jobOpening?.id ?? ""),
      title: String(selectedDetail.jobOpening?.title ?? "Untitled"),
    },
    offers: (isHr ? offers : []).map((o) => ({
      id: o.id,
      offerNumber: o.offerNumber,
      status: o.status,
      ctc: o.ctc == null ? null : Number(o.ctc),
      negotiationStatus: o.negotiationStatus,
      negotiationNote: o.negotiationNote,
      negotiationFollowUpAt: o.negotiationFollowUpAt,
    })),
    facts,
    viewerCanRate: session.employeeId != null,
  };
}
