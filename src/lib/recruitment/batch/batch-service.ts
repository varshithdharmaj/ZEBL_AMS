import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { readScorecardRatings, scorecardAverage } from "@/lib/recruitment/interview/scorecard";
import { batchCodeBase, batchCodePrefix, nextBatchCode } from "@/lib/recruitment/batch/batch-code";
import { BATCH_BUCKETS, batchBucket, countProgress, type BatchBucket, type BatchProgress } from "@/lib/recruitment/batch/batch-progress";
import { planBatchAdds } from "@/lib/recruitment/batch/batch-membership";
import { isBatchManagerOf } from "@/lib/recruitment/batch/batch-access";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";

async function assertCanManage(session: SessionUser) {
  RecruitmentPermissionService.requireModuleEnabled();
  await RecruitmentPermissionService.assertCanManageCandidates(session);
}

function isHr(session: SessionUser): boolean {
  return canAccessRecruitmentAdministration(session);
}

/** HR, or a manager HR shared this batch with. */
async function assertCanViewBatch(session: SessionUser, batchId: string) {
  RecruitmentPermissionService.requireModuleEnabled();
  if (isHr(session)) return;
  if (!(await isBatchManagerOf(session.id, batchId))) {
    throw new RecruitmentDomainError("REC_NOT_FOUND", "Batch not found.");
  }
}

async function getLiveBatch(batchId: string) {
  const batch = await prisma.hiringBatch.findFirst({ where: { id: batchId, deletedAt: null } });
  if (!batch) throw new RecruitmentDomainError("REC_NOT_FOUND", "Batch not found.");
  return batch;
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

export type BatchListItem = {
  id: string;
  code: string;
  name: string | null;
  interviewDate: Date | null;
  status: HiringBatchStatus;
  createdAt: Date;
  closedAt: Date | null;
  createdByName: string | null;
  candidateCount: number;
  progress: BatchProgress;
  /** Managers HR shared the batch with. */
  managers: Array<{ userId: string; name: string }>;
};

/**
 * HR sees every batch. With `sharedWithMe`, only the batches HR shared with
 * this user (the manager's page).
 */
export async function listBatches(
  session: SessionUser,
  options: { status?: HiringBatchStatus | "all"; limit?: number; sharedWithMe?: boolean } = {}
): Promise<BatchListItem[]> {
  if (options.sharedWithMe) RecruitmentPermissionService.requireModuleEnabled();
  else await assertCanManage(session);
  const status = options.status ?? HiringBatchStatus.open;
  const batches = await prisma.hiringBatch.findMany({
    where: {
      deletedAt: null,
      ...(status === "all" ? {} : { status }),
      ...(options.sharedWithMe ? { managers: { some: { userId: session.id } } } : {}),
    },
    orderBy: [{ interviewDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    ...(options.limit ? { take: options.limit } : {}),
    select: {
      id: true,
      code: true,
      name: true,
      interviewDate: true,
      status: true,
      createdAt: true,
      closedAt: true,
      createdBy: { select: { email: true, employee: { select: { name: true } } } },
      members: {
        where: { application: { deletedAt: null } },
        select: { application: { select: { currentStage: true, status: true } } },
      },
      managers: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, user: { select: { email: true, employee: { select: { name: true } } } } },
      },
    },
  });

  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    interviewDate: b.interviewDate,
    status: b.status,
    createdAt: b.createdAt,
    closedAt: b.closedAt,
    createdByName: b.createdBy?.employee?.name ?? b.createdBy?.email ?? null,
    candidateCount: b.members.length,
    managers: b.managers.map((m) => ({ userId: m.userId, name: m.user.employee?.name ?? m.user.email })),
    progress: countProgress(
      b.members.map((m) => ({ stage: m.application.currentStage, status: m.application.status }))
    ),
  }));
}

export async function createBatch(
  session: SessionUser,
  input: { name?: string | null; interviewDate: Date }
): Promise<{ id: string; code: string }> {
  await assertCanManage(session);
  const name = input.name?.trim() || null;
  return withNextBatchCode(input.interviewDate, (code) =>
    prisma.hiringBatch.create({
      data: { code, name, interviewDate: input.interviewDate, createdByUserId: session.id },
      select: { id: true, code: true },
    })
  );
}

/**
 * Runs `write` with the next Batch ID for that interview date. Two HR users
 * saving at the same moment can pick the same ID; the unique index rejects
 * one, which then retries with the next number.
 */
async function withNextBatchCode<T>(interviewDate: Date, write: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.hiringBatch.findMany({
      where: { code: { startsWith: batchCodePrefix(interviewDate) } },
      select: { code: true },
    });
    try {
      return await write(nextBatchCode(existing.map((b) => b.code), interviewDate));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new RecruitmentDomainError("REC_CONFLICT", "Couldn't save the batch. Please try again.");
}

export async function renameBatch(session: SessionUser, batchId: string, name: string | null) {
  await assertCanManage(session);
  await getLiveBatch(batchId);
  await prisma.hiringBatch.update({ where: { id: batchId }, data: { name: name?.trim() || null } });
}

export async function setBatchInterviewDate(session: SessionUser, batchId: string, interviewDate: Date) {
  await assertCanManage(session);
  const batch = await getLiveBatch(batchId);
  // The Batch ID comes from the date, so a new date gets a new ID.
  const base = batchCodeBase(interviewDate);
  if (batch.code === base || batch.code.startsWith(`${base}-`)) {
    await prisma.hiringBatch.update({ where: { id: batchId }, data: { interviewDate } });
    return;
  }
  await withNextBatchCode(interviewDate, (code) =>
    prisma.hiringBatch.update({ where: { id: batchId }, data: { interviewDate, code } })
  );
}

export async function setBatchStatus(session: SessionUser, batchId: string, status: HiringBatchStatus) {
  await assertCanManage(session);
  const batch = await getLiveBatch(batchId);
  if (batch.status === status) return;

  if (status === HiringBatchStatus.open) {
    // Reopening must not put an application in two open batches.
    const clash = await prisma.hiringBatchMember.findFirst({
      where: {
        batchId: { not: batchId },
        batch: { status: HiringBatchStatus.open, deletedAt: null },
        application: { batchMemberships: { some: { batchId } } },
      },
      select: { batch: { select: { code: true } }, application: { select: { candidate: { select: { fullName: true } } } } },
    });
    if (clash) {
      throw new RecruitmentDomainError(
        "REC_CONFLICT",
        `${clash.application.candidate.fullName} is now in open batch ${clash.batch.code}. Remove them from one batch first.`
      );
    }
  }

  await prisma.hiringBatch.update({
    where: { id: batchId },
    data: { status, closedAt: status === HiringBatchStatus.closed ? new Date() : null },
  });
}

// ---------------------------------------------------------------------------
// Batch sheet
// ---------------------------------------------------------------------------

export type BatchSheetRow = {
  memberId: string;
  slNo: number;
  applicationId: string;
  candidateId: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  education: string | null;
  experienceYears: number | null;
  /** Most recent first, as "company · role". */
  experiences: Array<{ company: string; role: string | null; current: boolean }>;
  currentCtc: number | null;
  expectedCtc: number | null;
  noticePeriod: string | null;
  remarks: string | null;
  resume: { id: string; fileName: string } | null;
  role: string;
  jobOpeningId: string;
  stage: string;
  stageLabel: string;
  bucket: BatchBucket;
  hrStars: number | null;
  hrScorecards: number;
  managerStars: number | null;
  managerScorecards: number;
  /** Team comments on the candidate (the candidate's notes this user can see). */
  commentCount: number;
};

export type BatchSheet = {
  id: string;
  code: string;
  name: string | null;
  interviewDate: Date | null;
  status: HiringBatchStatus;
  createdAt: Date;
  closedAt: Date | null;
  createdByName: string | null;
  rows: BatchSheetRow[];
  progress: BatchProgress;
  /** Managers HR shared the batch with. */
  managers: Array<{ userId: string; name: string }>;
};

function noticePeriodText(days: number | null, notes: string | null): string | null {
  if (days != null) return days === 0 ? "Immediate" : `${days} days`;
  return notes;
}

/**
 * The Stage column uses the paper plan's words (HR Round, Manager Round, Hire,
 * Reject, Hold), the same as the Pipeline columns; a job's own Add stage
 * column keeps its name.
 */
function stageLabel(stage: string, status: string, customLabel: string | null | undefined): string {
  const closed = status === "rejected" || status === "withdrawn" || status === "on_hold";
  if (stage.startsWith("custom_") && customLabel && !closed) return customLabel;
  const bucket = batchBucket(stage, status);
  return BATCH_BUCKETS.find((b) => b.id === bucket)?.label ?? stage;
}

/** Average stars across submitted scorecards for one round (HR or manager), per application. */
async function loadRoundStars(applicationIds: string[], roundType: "hr" | "manager") {
  const out: Record<string, { stars: number | null; count: number }> = {};
  if (applicationIds.length === 0) return out;
  const feedback = await prisma.interviewFeedback.findMany({
    where: {
      submittedAt: { not: null },
      interview: { applicationId: { in: applicationIds }, roundType },
    },
    select: { ratingsJson: true, interview: { select: { applicationId: true } } },
  });
  const sums: Record<string, { total: number; count: number }> = {};
  for (const f of feedback) {
    const avg = scorecardAverage(readScorecardRatings(f.ratingsJson));
    const appId = f.interview.applicationId;
    const acc = (sums[appId] ??= { total: 0, count: 0 });
    if (avg != null) {
      acc.total += avg;
      acc.count += 1;
    }
    out[appId] = { stars: null, count: (out[appId]?.count ?? 0) + 1 };
  }
  for (const [appId, acc] of Object.entries(sums)) {
    out[appId].stars = acc.count ? Math.round((acc.total / acc.count) * 10) / 10 : null;
  }
  return out;
}

/** What a candidate panel shows about one application, for Batches and Pipeline alike. */
export type CandidateFacts = Omit<BatchSheetRow, "memberId" | "slNo" | "remarks">;

function factsApplicationSelect(viewer: SessionUser) {
  return {
    id: true,
    status: true,
    currentStage: true,
    currentStageRef: { select: { label: true } },
    jobOpening: { select: { id: true, title: true } },
    candidate: {
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        location: true,
        totalExperienceYears: true,
        currentCtc: true,
        expectedCtc: true,
        noticePeriodDays: true,
        availabilityNotes: true,
        experiences: {
          orderBy: { sortOrder: "asc" },
          select: {
            company: true,
            companyName: true,
            title: true,
            designation: true,
            isCurrent: true,
            currentlyWorking: true,
          },
        },
        educations: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { degree: true, field: true, fieldOfStudy: true, institution: true },
        },
        documents: {
          where: { documentType: "resume", deletedAt: null },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { id: true, fileName: true },
        },
        _count: { select: { notes: { where: visibleNotesWhere(viewer) } } },
      },
    },
  } satisfies Prisma.ApplicationSelect;
}

type FactsApplication = Prisma.ApplicationGetPayload<{ select: ReturnType<typeof factsApplicationSelect> }>;
type RoundStars = Awaited<ReturnType<typeof loadRoundStars>>;

function toCandidateFacts(app: FactsApplication, hr: RoundStars, manager: RoundStars): CandidateFacts {
  const c = app.candidate;
  const edu = c.educations[0];
  const education = edu
    ? [edu.degree, edu.fieldOfStudy || edu.field].filter(Boolean).join(" in ") || edu.institution || null
    : null;
  return {
    applicationId: app.id,
    candidateId: c.id,
    name: c.fullName,
    email: c.email,
    phone: c.phone,
    location: c.location,
    education,
    experienceYears: c.totalExperienceYears == null ? null : Number(c.totalExperienceYears),
    experiences: c.experiences
      .map((e) => ({
        company: (e.companyName || e.company).trim(),
        role: (e.designation || e.title).trim() || null,
        current: Boolean(e.isCurrent || e.currentlyWorking),
      }))
      .filter((e) => e.company),
    currentCtc: c.currentCtc == null ? null : Number(c.currentCtc),
    expectedCtc: c.expectedCtc == null ? null : Number(c.expectedCtc),
    noticePeriod: noticePeriodText(c.noticePeriodDays, c.availabilityNotes),
    resume: c.documents[0] ? { id: c.documents[0].id, fileName: c.documents[0].fileName } : null,
    role: app.jobOpening.title,
    jobOpeningId: app.jobOpening.id,
    stage: app.currentStage,
    stageLabel: stageLabel(app.currentStage, app.status, app.currentStageRef?.label),
    bucket: batchBucket(app.currentStage, app.status),
    hrStars: hr[app.id]?.stars ?? null,
    hrScorecards: hr[app.id]?.count ?? 0,
    managerStars: manager[app.id]?.stars ?? null,
    managerScorecards: manager[app.id]?.count ?? 0,
    commentCount: c._count.notes,
  };
}

/** The panel facts for one application (the Pipeline panel). Null if it is gone. */
export async function loadCandidateFacts(session: SessionUser, applicationId: string): Promise<CandidateFacts | null> {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: factsApplicationSelect(session),
  });
  if (!app) return null;
  const [hr, manager] = await Promise.all([loadRoundStars([app.id], "hr"), loadRoundStars([app.id], "manager")]);
  return toCandidateFacts(app, hr, manager);
}

export async function getBatchSheet(session: SessionUser, batchId: string): Promise<BatchSheet | null> {
  await assertCanViewBatch(session, batchId);
  const batch = await prisma.hiringBatch.findFirst({
    where: { id: batchId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      interviewDate: true,
      status: true,
      createdAt: true,
      closedAt: true,
      createdBy: { select: { email: true, employee: { select: { name: true } } } },
      members: {
        where: { application: { deletedAt: null } },
        orderBy: [{ slNo: "asc" }, { addedAt: "asc" }],
        select: {
          id: true,
          slNo: true,
          remarks: true,
          application: { select: factsApplicationSelect(session) },
        },
      },
      managers: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, user: { select: { email: true, employee: { select: { name: true } } } } },
      },
    },
  });
  if (!batch) return null;

  const ids = batch.members.map((m) => m.application.id);
  const [hr, manager] = await Promise.all([loadRoundStars(ids, "hr"), loadRoundStars(ids, "manager")]);
  const rows: BatchSheetRow[] = batch.members.map((m) => ({
    memberId: m.id,
    slNo: m.slNo,
    remarks: m.remarks,
    ...toCandidateFacts(m.application, hr, manager),
  }));

  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    interviewDate: batch.interviewDate,
    status: batch.status,
    createdAt: batch.createdAt,
    closedAt: batch.closedAt,
    createdByName: batch.createdBy?.employee?.name ?? batch.createdBy?.email ?? null,
    rows,
    managers: batch.managers.map((m) => ({ userId: m.userId, name: m.user.employee?.name ?? m.user.email })),
    progress: countProgress(
      batch.members.map((m) => ({ stage: m.application.currentStage, status: m.application.status }))
    ),
  };
}

// ---------------------------------------------------------------------------
// Comments (the candidate's notes, shown in the batch panel)
// ---------------------------------------------------------------------------

/** Team notes (and HR-only ones for HR), plus the viewer's own private ones. */
function visibleNotesWhere(viewer: SessionUser): Prisma.CandidateNoteWhereInput {
  const shared: Prisma.CandidateNoteWhereInput = isHr(viewer)
    ? { visibility: { not: "private" } }
    : { visibility: "team" };
  return { deletedAt: null, OR: [shared, { authorUserId: viewer.id }] };
}

export type BatchComment = {
  id: string;
  body: string;
  authorName: string;
  mine: boolean;
  /** Only HR can see it. */
  hrOnly: boolean;
  createdAt: Date;
};

export async function listCandidateComments(session: SessionUser, candidateId: string): Promise<BatchComment[]> {
  RecruitmentPermissionService.requireModuleEnabled();
  if (!isHr(session) && !(await RecruitmentPermissionService.canWriteCandidateDiscussion(session, candidateId))) {
    throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
  }
  const notes = await prisma.candidateNote.findMany({
    where: { candidateId, ...visibleNotesWhere(session) },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorUserId: true,
      visibility: true,
      author: { select: { email: true, employee: { select: { name: true } } } },
    },
  });
  return notes.map((n) => ({
    id: n.id,
    body: n.body,
    authorName: n.author.employee?.name ?? n.author.email,
    mine: n.authorUserId === session.id,
    hrOnly: n.visibility === "hr_only",
    createdAt: n.createdAt,
  }));
}

export async function updateMemberRemarks(session: SessionUser, memberId: string, remarks: string | null) {
  await assertCanManage(session);
  const member = await prisma.hiringBatchMember.findFirst({
    where: { id: memberId, batch: { deletedAt: null } },
    select: { id: true, batchId: true },
  });
  if (!member) throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate is no longer in this batch.");
  await prisma.hiringBatchMember.update({
    where: { id: memberId },
    data: { remarks: remarks?.trim() || null },
  });
  return member.batchId;
}

// ---------------------------------------------------------------------------
// Sharing a batch with managers
// ---------------------------------------------------------------------------

export type BatchManagerOption = {
  userId: string;
  name: string;
  email: string;
  designation: string | null;
};

const managerUserSelect = {
  id: true,
  email: true,
  employee: { select: { name: true, designation: true } },
} as const;

function toManagerOption(u: { id: string; email: string; employee: { name: string; designation: string | null } | null }): BatchManagerOption {
  return { userId: u.id, name: u.employee?.name ?? u.email, email: u.email, designation: u.employee?.designation ?? null };
}

export async function listBatchManagers(session: SessionUser, batchId: string): Promise<BatchManagerOption[]> {
  await assertCanManage(session);
  const rows = await prisma.hiringBatchManager.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
    select: { user: { select: managerUserSelect } },
  });
  return rows.map((r) => toManagerOption(r.user));
}

/**
 * People HR can share a batch with: active logins linked to an employee,
 * other than HR / Super Admin (they see every batch already). Managers first.
 */
export async function searchManagerOptions(session: SessionUser, batchId: string, query: string): Promise<BatchManagerOption[]> {
  await assertCanManage(session);
  const q = query.trim();
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      employeeId: { not: null },
      role: { in: ["manager", "employee"] },
      hiringBatchShares: { none: { batchId } },
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { employee: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    take: 20,
    select: managerUserSelect,
  });
  return users.map(toManagerOption);
}

export async function shareBatch(session: SessionUser, batchId: string, userIds: string[]): Promise<number> {
  await assertCanManage(session);
  await getLiveBatch(batchId);
  const res = await prisma.hiringBatchManager.createMany({
    data: userIds.map((userId) => ({ batchId, userId, addedByUserId: session.id })),
    skipDuplicates: true,
  });
  return res.count;
}

export async function unshareBatch(session: SessionUser, batchId: string, userId: string): Promise<void> {
  await assertCanManage(session);
  await prisma.hiringBatchManager.deleteMany({ where: { batchId, userId } });
}

export async function removeMembers(session: SessionUser, batchId: string, memberIds: string[]) {
  await assertCanManage(session);
  await getLiveBatch(batchId);
  const { count } = await prisma.hiringBatchMember.deleteMany({
    where: { batchId, id: { in: memberIds } },
  });
  return count;
}

// ---------------------------------------------------------------------------
// Adding candidates (from the Pipeline list)
// ---------------------------------------------------------------------------

export type OpenBatchOption = {
  id: string;
  code: string;
  name: string | null;
  interviewDate: Date | null;
  candidateCount: number;
};

export async function listOpenBatchOptions(session: SessionUser): Promise<OpenBatchOption[]> {
  await assertCanManage(session);
  const batches = await prisma.hiringBatch.findMany({
    where: { deletedAt: null, status: HiringBatchStatus.open },
    orderBy: [{ interviewDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      name: true,
      interviewDate: true,
      _count: { select: { members: { where: { application: { deletedAt: null } } } } },
    },
  });
  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    interviewDate: b.interviewDate,
    candidateCount: b._count.members,
  }));
}

export type AddToBatchResult = {
  added: number;
  skipped: Array<{ name: string; reason: string }>;
};

export async function addApplicationsToBatch(
  session: SessionUser,
  batchId: string,
  applicationIds: string[]
): Promise<AddToBatchResult> {
  await assertCanManage(session);
  const batch = await getLiveBatch(batchId);
  if (batch.status !== HiringBatchStatus.open) {
    throw new RecruitmentDomainError("REC_VALIDATION", "This batch is closed. Reopen it to add candidates.");
  }

  const apps = await prisma.application.findMany({
    where: { id: { in: applicationIds }, deletedAt: null },
    select: {
      id: true,
      status: true,
      candidate: { select: { fullName: true } },
      batchMemberships: {
        where: { batch: { deletedAt: null } },
        select: { batchId: true, batch: { select: { code: true, status: true } } },
      },
    },
  });
  const byId = new Map(apps.map((a) => [a.id, a]));
  const plan = planBatchAdds(
    batchId,
    applicationIds.flatMap((id) => {
      const a = byId.get(id);
      return a
        ? [
            {
              applicationId: a.id,
              name: a.candidate.fullName,
              status: a.status,
              batches: a.batchMemberships.map((m) => ({
                batchId: m.batchId,
                code: m.batch.code,
                open: m.batch.status === HiringBatchStatus.open,
              })),
            },
          ]
        : [];
    })
  );
  if (plan.add.length === 0) return { added: 0, skipped: plan.skipped };

  // Two HR users adding at once can pick the same Sl.no; ordering still holds by
  // addedAt, so a duplicate number is cosmetic and not worth a lock.
  const last = await prisma.hiringBatchMember.aggregate({ where: { batchId }, _max: { slNo: true } });
  let nextSlNo = (last._max.slNo ?? 0) + 1;
  const { count } = await prisma.hiringBatchMember.createMany({
    data: plan.add.map((applicationId) => ({
      batchId,
      applicationId,
      slNo: nextSlNo++,
      addedByUserId: session.id,
    })),
    skipDuplicates: true,
  });
  return { added: count, skipped: plan.skipped };
}


export type BatchCandidateOption = {
  applicationId: string;
  name: string;
  role: string;
  stageLabel: string;
  appliedAt: Date;
};

/**
 * Candidates HR can add to this batch from the batch page: open applications
 * (active or on hold) that aren't already in an open batch. Matches name,
 * email or phone; with no search text, the most recent applications.
 */
export async function searchCandidatesForBatch(
  session: SessionUser,
  batchId: string,
  query: string
): Promise<BatchCandidateOption[]> {
  await assertCanManage(session);
  await getLiveBatch(batchId);
  const q = query.trim();
  const digits = q.replace(/\D/g, "");
  const apps = await prisma.application.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "on_hold"] },
      candidate: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
              ],
            }
          : {}),
      },
      batchMemberships: { none: { batch: { status: HiringBatchStatus.open, deletedAt: null } } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      status: true,
      currentStage: true,
      createdAt: true,
      candidate: { select: { fullName: true } },
      jobOpening: { select: { title: true } },
    },
  });
  return apps.map((a) => ({
    applicationId: a.id,
    name: a.candidate.fullName,
    role: a.jobOpening.title,
    stageLabel: BATCH_BUCKETS.find((b) => b.id === batchBucket(a.currentStage, a.status))?.label ?? a.currentStage,
    appliedAt: a.createdAt,
  }));
}
