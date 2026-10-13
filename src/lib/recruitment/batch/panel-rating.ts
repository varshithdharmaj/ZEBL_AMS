import "server-only";

import { InterviewRoundType, InterviewStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { createInterviewService } from "@/lib/recruitment/services/interview-service";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";
import { assertManagerCanDecide } from "@/lib/recruitment/batch/batch-access";
import { PermissionError } from "@/lib/permissions";
import type { SubmitFeedbackInput } from "@/lib/validation/schemas/recruitment/interviews";

export type PanelRound = "hr" | "manager";

const ROUND_TITLE: Record<PanelRound, string> = { hr: "HR Round", manager: "Manager Round" };

/**
 * The batch is the interview: rating someone in the candidate panel uses that
 * round's interview, and makes one from the batch's interview date if there
 * isn't one yet. The scorecard itself is saved the usual way, so HR ★,
 * Manager ★ and reports read it like any other.
 */
async function roundInterviewId(session: SessionUser, applicationId: string, round: PanelRound): Promise<string> {
  const roundType = round === "hr" ? InterviewRoundType.hr : InterviewRoundType.manager;
  const existing = await prisma.interview.findFirst({
    where: { applicationId, roundType, deletedAt: null, status: { not: InterviewStatus.cancelled } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const app = await prisma.application.findFirst({ where: { id: applicationId, deletedAt: null }, select: { id: true } });
  if (!app) throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
  const member = await prisma.hiringBatchMember.findFirst({
    where: { applicationId, batch: { deletedAt: null } },
    orderBy: { addedAt: "desc" },
    select: { batch: { select: { interviewDate: true } } },
  });
  const created = await prisma.interview.create({
    data: {
      applicationId,
      roundType,
      status: InterviewStatus.completed,
      title: ROUND_TITLE[round],
      scheduledStart: member?.batch.interviewDate ?? new Date(),
      createdByUserId: session.id,
    },
    select: { id: true },
  });
  return created.id;
}

export async function savePanelRating(
  session: SessionUser,
  input: { applicationId: string; round: PanelRound } & Omit<SubmitFeedbackInput, "interviewId">
): Promise<void> {
  RecruitmentPermissionService.requireModuleEnabled();
  const isHr = canAccessRecruitmentAdministration(session);
  if (isHr) {
    await RecruitmentPermissionService.assertCanManageCandidates(session);
  } else {
    // A shared batch's manager rates the Manager Round, for people in it.
    if (input.round !== "manager") throw new PermissionError("Managers rate the Manager Round.");
    await assertManagerCanDecide(session.id, input.applicationId, "rate");
  }
  if (!session.employeeId) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "Your login isn't linked to an employee profile, so ratings can't be saved. Ask an admin to link it."
    );
  }
  const interviewId = await roundInterviewId(session, input.applicationId, input.round);
  if (!isHr) {
    // On the round's panel, so the scorecard is theirs like any interviewer's.
    await prisma.interviewPanelist.upsert({
      where: { interviewId_employeeId: { interviewId, employeeId: session.employeeId } },
      create: { interviewId, employeeId: session.employeeId },
      update: {},
    });
  }
  await createInterviewService().submitFeedback(session, {
    interviewId,
    verdict: input.verdict,
    ratingsJson: input.ratingsJson,
    remarks: input.remarks,
  });
}
