import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { CandidateSource, HiringBatchStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentDomainError, isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { PIPELINE_STAGE_LABELS } from "@/lib/recruitment/shared/pipeline-stage-groups";
import { readScorecardRatings, scorecardAverage } from "@/lib/recruitment/interview/scorecard";
import { batchCodePrefix, istYear, nextBatchCode } from "@/lib/recruitment/batch/batch-code";
import { batchBucket, countProgress, type BatchBucket, type BatchProgress } from "@/lib/recruitment/batch/batch-progress";
import {
  parsePastedRows,
  phoneMatchKey,
  remarksForRow,
  type ParsedRow,
} from "@/lib/recruitment/batch/parse-pasted-rows";

const MAX_PASTE_ROWS = 300;

async function assertCanManage(session: SessionUser) {
  RecruitmentPermissionService.requireModuleEnabled();
  await RecruitmentPermissionService.assertCanManageCandidates(session);
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
  status: HiringBatchStatus;
  createdAt: Date;
  closedAt: Date | null;
  createdByName: string | null;
  candidateCount: number;
  progress: BatchProgress;
};

export async function listBatches(
  session: SessionUser,
  options: { status?: HiringBatchStatus | "all" } = {}
): Promise<BatchListItem[]> {
  await assertCanManage(session);
  const status = options.status ?? HiringBatchStatus.open;
  const batches = await prisma.hiringBatch.findMany({
    where: { deletedAt: null, ...(status === "all" ? {} : { status }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      createdAt: true,
      closedAt: true,
      createdBy: { select: { email: true, employee: { select: { name: true } } } },
      members: {
        where: { application: { deletedAt: null } },
        select: { application: { select: { currentStage: true, status: true } } },
      },
    },
  });

  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    status: b.status,
    createdAt: b.createdAt,
    closedAt: b.closedAt,
    createdByName: b.createdBy?.employee?.name ?? b.createdBy?.email ?? null,
    candidateCount: b.members.length,
    progress: countProgress(
      b.members.map((m) => ({ stage: m.application.currentStage, status: m.application.status }))
    ),
  }));
}

export async function createBatch(
  session: SessionUser,
  input: { name?: string | null }
): Promise<{ id: string; code: string }> {
  await assertCanManage(session);
  const name = input.name?.trim() || null;
  const year = istYear();

  // Two HR users creating a batch at the same moment can pick the same next
  // code; the unique index rejects one, which then retries with the next code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.hiringBatch.findMany({
      where: { code: { startsWith: batchCodePrefix(year) } },
      select: { code: true },
    });
    const code = nextBatchCode(
      existing.map((b) => b.code),
      year
    );
    try {
      const created = await prisma.hiringBatch.create({
        data: { code, name, createdByUserId: session.id },
        select: { id: true, code: true },
      });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new RecruitmentDomainError("REC_CONFLICT", "Couldn't create the batch. Please try again.");
}

export async function renameBatch(session: SessionUser, batchId: string, name: string | null) {
  await assertCanManage(session);
  await getLiveBatch(batchId);
  await prisma.hiringBatch.update({ where: { id: batchId }, data: { name: name?.trim() || null } });
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
  qualification: string | null;
  experienceYears: number | null;
  availability: string | null;
  remarks: string | null;
  profile: string | null;
  resume: { id: string; fileName: string } | null;
  role: string;
  jobOpeningId: string;
  stage: string;
  stageLabel: string;
  bucket: BatchBucket;
  hrStars: number | null;
  hrScorecards: number;
};

export type BatchSheet = {
  id: string;
  code: string;
  name: string | null;
  status: HiringBatchStatus;
  createdAt: Date;
  closedAt: Date | null;
  createdByName: string | null;
  rows: BatchSheetRow[];
  progress: BatchProgress;
};

function availabilityText(notes: string | null, days: number | null): string | null {
  if (notes) return notes;
  if (days == null) return null;
  return days === 0 ? "Immediate" : `${days} days`;
}

function stageLabel(stage: string, status: string, customLabel: string | null | undefined): string {
  if (status === "rejected") return "Rejected";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "on_hold") return "On Hold";
  if (customLabel) return customLabel;
  // The decision stage is where a candidate has passed the rounds: "Selected" in HR's words.
  if (stage === "decision") return "Selected";
  return PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS] || stage;
}

/** Average stars across submitted HR-round scorecards, per application. */
async function loadHrStars(applicationIds: string[]) {
  const out: Record<string, { stars: number | null; count: number }> = {};
  if (applicationIds.length === 0) return out;
  const feedback = await prisma.interviewFeedback.findMany({
    where: {
      submittedAt: { not: null },
      interview: { applicationId: { in: applicationIds }, roundType: "hr" },
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

export async function getBatchSheet(session: SessionUser, batchId: string): Promise<BatchSheet | null> {
  await assertCanManage(session);
  const batch = await prisma.hiringBatch.findFirst({
    where: { id: batchId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
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
          profileUrl: true,
          application: {
            select: {
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
                  noticePeriodDays: true,
                  availabilityNotes: true,
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
                },
              },
            },
          },
        },
      },
    },
  });
  if (!batch) return null;

  const stars = await loadHrStars(batch.members.map((m) => m.application.id));

  const rows: BatchSheetRow[] = batch.members.map((m) => {
    const app = m.application;
    const c = app.candidate;
    const edu = c.educations[0];
    const qualification = edu
      ? [edu.degree, edu.fieldOfStudy || edu.field].filter(Boolean).join(" in ") || edu.institution || null
      : null;
    return {
      memberId: m.id,
      slNo: m.slNo,
      applicationId: app.id,
      candidateId: c.id,
      name: c.fullName,
      email: c.email,
      phone: c.phone,
      location: c.location,
      qualification,
      experienceYears: c.totalExperienceYears == null ? null : Number(c.totalExperienceYears),
      availability: availabilityText(c.availabilityNotes, c.noticePeriodDays),
      remarks: m.remarks,
      profile: m.profileUrl,
      resume: c.documents[0] ? { id: c.documents[0].id, fileName: c.documents[0].fileName } : null,
      role: app.jobOpening.title,
      jobOpeningId: app.jobOpening.id,
      stage: app.currentStage,
      stageLabel: stageLabel(app.currentStage, app.status, app.currentStageRef?.label),
      bucket: batchBucket(app.currentStage, app.status),
      hrStars: stars[app.id]?.stars ?? null,
      hrScorecards: stars[app.id]?.count ?? 0,
    };
  });

  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    status: batch.status,
    createdAt: batch.createdAt,
    closedAt: batch.closedAt,
    createdByName: batch.createdBy?.employee?.name ?? batch.createdBy?.email ?? null,
    rows,
    progress: countProgress(
      batch.members.map((m) => ({ stage: m.application.currentStage, status: m.application.status }))
    ),
  };
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

export async function removeMembers(session: SessionUser, batchId: string, memberIds: string[]) {
  await assertCanManage(session);
  await getLiveBatch(batchId);
  const { count } = await prisma.hiringBatchMember.deleteMany({
    where: { batchId, id: { in: memberIds } },
  });
  return count;
}

/** Open jobs HR can add pasted candidates to. */
export async function listJobsForBatch(session: SessionUser) {
  await assertCanManage(session);
  return prisma.jobOpening.findMany({
    where: { deletedAt: null, status: { in: ["open", "on_hold", "draft"] } },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: { id: true, title: true, status: true },
  });
}

// ---------------------------------------------------------------------------
// Paste from Excel
// ---------------------------------------------------------------------------

export type PasteOutcome = "new" | "existing" | "in_this_batch" | "in_other_batch" | "error";

export type PastePreviewRow = {
  line: number;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  qualification: string | null;
  experienceYears: number | null;
  availability: string | null;
  remarks: string | null;
  outcome: PasteOutcome;
  /** Why the row is skipped, or which candidate it matched. */
  message: string | null;
  warnings: string[];
  candidateId: string | null;
};

export type PastePreview = {
  hasHeader: boolean;
  rows: PastePreviewRow[];
  counts: Record<PasteOutcome, number>;
};

type MatchContext = {
  row: ParsedRow;
  outcome: PasteOutcome;
  message: string | null;
  candidateId: string | null;
  /** Active application for the chosen job, when the candidate already has one. */
  applicationId: string | null;
};

async function matchRows(batchId: string, jobOpeningId: string, rows: ParsedRow[]): Promise<MatchContext[]> {
  const emails = [...new Set(rows.map((r) => r.email).filter((e): e is string => Boolean(e)))];
  const phoneKeys = [...new Set(rows.map((r) => phoneMatchKey(r.phone)).filter((p): p is string => Boolean(p)))];

  const candidates =
    emails.length || phoneKeys.length
      ? await prisma.candidate.findMany({
          where: {
            deletedAt: null,
            mergedIntoCandidateId: null,
            OR: [
              ...(emails.length ? [{ normalizedEmail: { in: emails } }] : []),
              ...phoneKeys.map((key) => ({ normalizedPhone: { endsWith: key } })),
            ],
          },
          select: {
            id: true,
            fullName: true,
            normalizedEmail: true,
            normalizedPhone: true,
            applications: {
              where: { jobOpeningId, deletedAt: null, status: { in: ["active", "on_hold"] } },
              select: {
                id: true,
                batchMemberships: {
                  where: { batch: { deletedAt: null } },
                  select: { batchId: true, batch: { select: { code: true, status: true } } },
                },
              },
            },
          },
        })
      : [];

  const byEmail = new Map<string, (typeof candidates)[number]>();
  const byPhone = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    if (c.normalizedEmail) byEmail.set(c.normalizedEmail, c);
    const key = phoneMatchKey(c.normalizedPhone);
    if (key && !byPhone.has(key)) byPhone.set(key, c);
  }

  return rows.map((row): MatchContext => {
    if (row.errors.length > 0) {
      return { row, outcome: "error", message: row.errors.join(" "), candidateId: null, applicationId: null };
    }
    const phoneKey = phoneMatchKey(row.phone);
    const match = (row.email && byEmail.get(row.email)) || (phoneKey && byPhone.get(phoneKey)) || null;
    if (!match) return { row, outcome: "new", message: null, candidateId: null, applicationId: null };

    const app = match.applications[0] ?? null;
    const memberships = app?.batchMemberships ?? [];
    if (memberships.some((m) => m.batchId === batchId)) {
      return {
        row,
        outcome: "in_this_batch",
        message: "Already in this batch.",
        candidateId: match.id,
        applicationId: app?.id ?? null,
      };
    }
    const otherOpen = memberships.find((m) => m.batch.status === HiringBatchStatus.open);
    if (otherOpen) {
      return {
        row,
        outcome: "in_other_batch",
        message: `Already in open batch ${otherOpen.batch.code} for this role.`,
        candidateId: match.id,
        applicationId: app?.id ?? null,
      };
    }
    return {
      row,
      outcome: "existing",
      message: match.fullName === row.name ? "Already in the system; will be linked." : `Matches ${match.fullName}; will be linked.`,
      candidateId: match.id,
      applicationId: app?.id ?? null,
    };
  });
}

function emptyCounts(): Record<PasteOutcome, number> {
  return { new: 0, existing: 0, in_this_batch: 0, in_other_batch: 0, error: 0 };
}

async function parseForBatch(session: SessionUser, batchId: string, jobOpeningId: string, text: string) {
  await assertCanManage(session);
  const batch = await getLiveBatch(batchId);
  if (batch.status !== HiringBatchStatus.open) {
    throw new RecruitmentDomainError("REC_VALIDATION", "This batch is closed. Reopen it to add candidates.");
  }
  const job = await prisma.jobOpening.findFirst({ where: { id: jobOpeningId, deletedAt: null }, select: { id: true } });
  if (!job) throw new RecruitmentDomainError("REC_VALIDATION", "Pick the role these candidates applied for.");

  const parsed = parsePastedRows(text);
  if (parsed.rows.length === 0) {
    throw new RecruitmentDomainError("REC_VALIDATION", "Nothing to add. Copy the rows from Excel and paste them here.");
  }
  if (parsed.rows.length > MAX_PASTE_ROWS) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      `That's ${parsed.rows.length} rows. Paste up to ${MAX_PASTE_ROWS} at a time.`
    );
  }
  return { parsed, matches: await matchRows(batchId, jobOpeningId, parsed.rows) };
}

export async function previewPaste(
  session: SessionUser,
  input: { batchId: string; jobOpeningId: string; text: string }
): Promise<PastePreview> {
  const { parsed, matches } = await parseForBatch(session, input.batchId, input.jobOpeningId, input.text);
  const counts = emptyCounts();
  const rows = matches.map((m): PastePreviewRow => {
    counts[m.outcome] += 1;
    return {
      line: m.row.line,
      name: m.row.name,
      email: m.row.email,
      phone: m.row.phone,
      location: m.row.location,
      qualification: m.row.qualification,
      experienceYears: m.row.experienceYears,
      availability: m.row.availabilityText,
      remarks: remarksForRow(m.row),
      outcome: m.outcome,
      message: m.message,
      warnings: m.row.warnings,
      candidateId: m.candidateId,
    };
  });
  return { hasHeader: parsed.hasHeader, rows, counts };
}

export type PasteImportResult = {
  added: number;
  linked: number;
  skipped: Array<{ line: number; name: string; reason: string }>;
};

/** Fills only fields the existing candidate left blank; never overwrites what's there. */
async function fillBlankCandidateFields(candidateId: string, row: ParsedRow) {
  const current = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      location: true,
      totalExperienceYears: true,
      noticePeriodDays: true,
      availabilityNotes: true,
      _count: { select: { educations: true } },
    },
  });
  if (!current) return;
  const data: Prisma.CandidateUpdateInput = {};
  if (!current.location && row.location) data.location = row.location;
  if (current.totalExperienceYears == null && row.experienceYears != null) {
    data.totalExperienceYears = row.experienceYears;
  }
  if (current.noticePeriodDays == null && row.noticePeriodDays != null) data.noticePeriodDays = row.noticePeriodDays;
  if (!current.availabilityNotes && row.availabilityText) data.availabilityNotes = row.availabilityText;
  if (current._count.educations === 0 && row.qualification) {
    data.educations = { create: { institution: "", degree: row.qualification, sortOrder: 0 } };
  }
  if (Object.keys(data).length > 0) await prisma.candidate.update({ where: { id: candidateId }, data });
}

export async function importPaste(
  session: SessionUser,
  input: { batchId: string; jobOpeningId: string; text: string }
): Promise<PasteImportResult> {
  const { matches } = await parseForBatch(session, input.batchId, input.jobOpeningId, input.text);
  const candidateService = createCandidateService();
  const applicationService = createApplicationService();

  const result: PasteImportResult = { added: 0, linked: 0, skipped: [] };
  const toAdd: MatchContext[] = [];
  for (const m of matches) {
    if (m.outcome === "new" || m.outcome === "existing") toAdd.push(m);
    else result.skipped.push({ line: m.row.line, name: m.row.name || "(no name)", reason: m.message ?? "Skipped." });
  }

  // Each row is a candidate + application through the normal services (duplicate
  // checks, stage history, timeline), so it takes ~20 queries. Run a few rows
  // at a time; batch rows are added afterwards in paste order so Sl.no stays in sequence.
  const prepared = await mapWithConcurrency(toAdd, IMPORT_CONCURRENCY, async (m) => {
    const { row } = m;
    try {
      let candidateId = m.candidateId;
      if (m.outcome === "new") {
        const created = await candidateService.createCandidate(session, {
          fullName: row.name,
          email: row.email,
          phone: row.phone,
          location: row.location,
          totalExperienceYears: row.experienceYears == null ? null : String(row.experienceYears),
          noticePeriodDays: row.noticePeriodDays,
          availabilityNotes: row.availabilityText,
          source: CandidateSource.csv_import,
          educations: row.qualification ? [{ institution: "", degree: row.qualification, sortOrder: 0 }] : undefined,
        } as Parameters<typeof candidateService.createCandidate>[1]);
        candidateId = created.id;
      } else if (candidateId) {
        await fillBlankCandidateFields(candidateId, row);
      }
      if (!candidateId) throw new Error("No candidate.");

      const applicationId =
        m.applicationId ??
        (
          await applicationService.createApplication(session, {
            candidateId,
            jobOpeningId: input.jobOpeningId,
            source: CandidateSource.csv_import,
          })
        ).id;

      return { ok: true as const, m, applicationId };
    } catch (error) {
      const reason = isRecruitmentDomainError(error)
        ? error.message
        : "Couldn't be added. Please try this row again.";
      if (!isRecruitmentDomainError(error)) console.error("[batch.importPaste] row failed", row.line, error);
      return { ok: false as const, m, reason };
    }
  });

  const last = await prisma.hiringBatchMember.aggregate({
    where: { batchId: input.batchId },
    _max: { slNo: true },
  });
  let nextSlNo = (last._max.slNo ?? 0) + 1;
  const memberRows: Prisma.HiringBatchMemberCreateManyInput[] = [];
  for (const p of prepared) {
    if (!p.ok) {
      result.skipped.push({ line: p.m.row.line, name: p.m.row.name, reason: p.reason });
      continue;
    }
    memberRows.push({
      batchId: input.batchId,
      applicationId: p.applicationId,
      slNo: nextSlNo++,
      remarks: remarksForRow(p.m.row),
      profileUrl: p.m.row.profile,
      addedByUserId: session.id,
    });
    if (p.m.outcome === "new") result.added += 1;
    else result.linked += 1;
  }
  if (memberRows.length > 0) {
    await prisma.hiringBatchMember.createMany({ data: memberRows, skipDuplicates: true });
  }

  result.skipped.sort((a, b) => a.line - b.line);
  return result;
}

const IMPORT_CONCURRENCY = 6;

/** Runs `fn` over items with at most `limit` in flight; results keep input order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
