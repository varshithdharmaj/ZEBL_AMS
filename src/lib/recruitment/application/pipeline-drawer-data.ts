import "server-only";

import type { SessionUser } from "@/lib/session";
import type { PipelineDrawerApplication } from "@/components/recruitment/applications/application-pipeline-drawer";
import { getApplicationCached } from "@/lib/recruitment/application/queries";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import {
  getCurrentHiringDecisionCached,
  getRequireDecisionForOfferCached,
} from "@/lib/recruitment/decision/queries";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import { prisma } from "@/lib/prisma";
import { TagService } from "@/lib/recruitment/tags";
import type { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { movableStageOptions } from "@/lib/recruitment/shared/next-stage";

function toPlainNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(typeof value === "object" ? String(value) : value);
  return Number.isFinite(n) ? n : null;
}

type JobDetail = Awaited<ReturnType<typeof prismaJobRepository.getJob>>;
type EmployeeOptions = Awaited<ReturnType<typeof getEmployeeOptions>>;

/**
 * Everything the pipeline side panel shows for one application: the job's own
 * stage order, interviews, offers, every round's scorecards, the resume, tags
 * and history. Shared by the pipeline board and the batch sheet so both open
 * the same panel. Returns null when the application is missing or not visible.
 */
export async function loadPipelineDrawerApplication(
  session: SessionUser,
  applicationId: string,
  context: { jobDetail?: JobDetail; employeeOptions?: EmployeeOptions } = {}
): Promise<PipelineDrawerApplication | null> {
  const [selectedDetail, selectedInterviews, selectedDecision, requireDecisionForOffer, offers] =
    await Promise.all([
      getApplicationCached(session, applicationId).catch(() => null),
      listInterviewsCached(session, { applicationId }, { page: 1, pageSize: 20 }),
      getCurrentHiringDecisionCached(session, applicationId).catch(() => null),
      getRequireDecisionForOfferCached(),
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
    ]);
  if (!selectedDetail) return null;

  const selectedOffers = offers.map((o) => ({
    id: o.id,
    offerNumber: o.offerNumber,
    status: o.status,
    ctc: o.ctc == null ? null : Number(o.ctc),
    negotiationStatus: o.negotiationStatus,
    negotiationNote: o.negotiationNote,
    negotiationFollowUpAt: o.negotiationFollowUpAt,
  }));

  const [selectedJob, selectedFeedback, employeeOptions, selectedTags] = await Promise.all([
    context.jobDetail?.id === selectedDetail.jobOpeningId
      ? Promise.resolve(context.jobDetail)
      : prismaJobRepository.getJob(selectedDetail.jobOpeningId),
    prisma.interviewFeedback.findMany({
      where: { interview: { applicationId: selectedDetail.id } },
      include: {
        author: { select: { name: true } },
        interview: { select: { title: true, scheduledStart: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    context.employeeOptions
      ? Promise.resolve(context.employeeOptions)
      : selectedDetail.assignedRecruiterUserId
        ? getEmployeeOptions()
        : Promise.resolve([] as EmployeeOptions),
    selectedDetail.candidate?.id
      ? TagService.listCandidateTags(String(selectedDetail.candidate.id))
      : Promise.resolve([]),
  ]);

  const selectedResume =
    selectedDetail.candidate?.documents
      ?.filter((d) => d.documentType === "resume")
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0] ?? null;
  const recruiterName = selectedDetail.assignedRecruiterUserId
    ? employeeOptions.find((e) => e.user?.id === selectedDetail.assignedRecruiterUserId)?.name ?? null
    : null;

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
    recruiterName,
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
      privateNotes: f.privateNotes,
    })),
    priority: (selectedDetail as { priority?: string | null }).priority ?? null,
    createdAt: selectedDetail.createdAt as Date | string,
    tags: selectedTags,
    candidate: {
      id: String(selectedDetail.candidate?.id ?? ""),
      fullName: String(selectedDetail.candidate?.fullName ?? "Unknown"),
      email: selectedDetail.candidate?.email ?? null,
      phone: selectedDetail.candidate?.phone ?? null,
      // A Prisma Decimal can't be passed to the client panel; send a plain number.
      totalExperienceYears: toPlainNumber(
        (selectedDetail.candidate as { totalExperienceYears?: unknown } | null)?.totalExperienceYears
      ),
      currentCompany:
        (selectedDetail.candidate as { currentCompany?: string | null } | null)?.currentCompany ??
        null,
      location: (selectedDetail.candidate as { location?: string | null } | null)?.location ?? null,
      noticePeriodDays:
        (selectedDetail.candidate as { noticePeriodDays?: number | null } | null)
          ?.noticePeriodDays ?? null,
    },
    jobOpening: {
      id: String(selectedDetail.jobOpening?.id ?? ""),
      title: String(selectedDetail.jobOpening?.title ?? "Untitled"),
    },
    interviews: selectedInterviews.items.map((item) => ({
      id: String(item.id),
      title: String(item.title ?? "Interview"),
      scheduledStart: item.scheduledStart as Date | string,
      status: String(item.status ?? ""),
    })),
    offers: selectedOffers,
    stageHistory: Array.isArray(selectedDetail.stageHistory)
      ? selectedDetail.stageHistory.map((h: Record<string, unknown>) => ({
          id: String(h.id),
          toStage: (h.toStage as string | null) ?? null,
          fromStage: (h.fromStage as string | null) ?? null,
          createdAt: h.createdAt as Date | string,
          note: (h.note as string | null) ?? null,
          actorEmail: (h.actor as { email?: string | null } | null)?.email ?? null,
        }))
      : [],
    assessment: (selectedDetail.assessment as string | null) ?? null,
    assessmentUpdatedAt: (selectedDetail.assessmentUpdatedAt as Date | string | null) ?? null,
    assessmentUpdatedByEmail:
      (
        selectedDetail as {
          assessmentUpdatedBy?: { email?: string | null } | null;
        }
      ).assessmentUpdatedBy?.email ?? null,
    currentDecision: selectedDecision,
    requireDecisionForOffer,
  };
}
