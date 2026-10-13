import "server-only";

import { prisma } from "@/lib/prisma";
import { PIPELINE_BOARD_COLUMN_FILTERS } from "@/lib/recruitment/shared/pipeline-stage-groups";
import type { RecruitmentPipelineStage } from "@/generated/prisma/enums";

/**
 * What the HR recruitment dashboard shows: the things to act on today, the
 * next few interviews, and this week's numbers. Each part is one query.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const OFFER_REPLY_DAYS = 3;

/** Midnight IST today, and the Monday of this week, as instants. */
function istBoundaries(now: Date) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  return {
    todayStart: new Date(midnightIst),
    tomorrowStart: new Date(midnightIst + DAY_MS),
    inThreeDays: new Date(midnightIst + 4 * DAY_MS),
    weekStart: new Date(midnightIst - daysSinceMonday * DAY_MS),
  };
}

const HR_ROUND_STAGES = PIPELINE_BOARD_COLUMN_FILTERS.find((g) => g.id === "hr_round")!.stages as readonly RecruitmentPipelineStage[];

export type TodayInterview = {
  id: string;
  start: Date;
  candidateName: string;
  jobTitle: string;
  round: string;
};

export type HrToday = {
  hireWithoutOffer: { count: number; names: string[] };
  missingHrStars: { count: number; batchId: string | null; batchCode: string | null };
  interviewsToday: TodayInterview[];
  offersNoReply: { count: number; names: string[] };
  pendingConversions: number;
  upcoming: TodayInterview[];
  week: { added: number; hrRated: number; sentToManager: number; hired: number; joined: number; weekStart: Date };
};

const interviewSelect = {
  id: true,
  scheduledStart: true,
  roundType: true,
  title: true,
  application: { select: { candidate: { select: { fullName: true } }, jobOpening: { select: { title: true } } } },
} as const;

function toInterview(i: {
  id: string;
  scheduledStart: Date | null;
  roundType: string;
  title: string | null;
  application: { candidate: { fullName: string }; jobOpening: { title: string } };
}): TodayInterview {
  return {
    id: i.id,
    start: i.scheduledStart ?? new Date(0),
    candidateName: i.application.candidate.fullName,
    jobTitle: i.application.jobOpening.title,
    round: i.title ?? `${i.roundType.replace(/_/g, " ")} round`,
  };
}

export async function loadHrToday(now: Date = new Date()): Promise<HrToday> {
  const { todayStart, tomorrowStart, inThreeDays, weekStart } = istBoundaries(now);
  const replyCutoff = new Date(now.getTime() - OFFER_REPLY_DAYS * DAY_MS);
  const liveApp = { deletedAt: null } as const;

  const [
    hireWithoutOffer,
    missingStars,
    interviewsToday,
    upcoming,
    offersNoReply,
    pendingConversions,
    added,
    hrRated,
    sentToManager,
    hired,
    joined,
  ] = await Promise.all([
    // Marked Hire (decision) with no live offer yet.
    prisma.application.findMany({
      where: {
        ...liveApp,
        status: "active",
        currentStage: "decision",
        offers: { none: { status: { in: ["draft", "released", "accepted"] } } },
      },
      orderBy: { stageEnteredAt: "asc" },
      take: 50,
      select: { candidate: { select: { fullName: true } } },
    }),
    // In an open batch, still in the HR round, and no submitted HR-round stars.
    prisma.hiringBatchMember.findMany({
      where: {
        batch: { status: "open", deletedAt: null },
        application: {
          ...liveApp,
          status: "active",
          currentStage: { in: [...HR_ROUND_STAGES] },
          interviews: { none: { roundType: "hr", feedback: { some: { submittedAt: { not: null } } } } },
        },
      },
      orderBy: { batch: { interviewDate: "asc" } },
      take: 200,
      select: { batchId: true, batch: { select: { code: true } } },
    }),
    prisma.interview.findMany({
      where: { status: "scheduled", deletedAt: null, scheduledStart: { gte: todayStart, lt: tomorrowStart }, application: liveApp },
      orderBy: { scheduledStart: "asc" },
      take: 10,
      select: interviewSelect,
    }),
    prisma.interview.findMany({
      where: { status: "scheduled", deletedAt: null, scheduledStart: { gte: tomorrowStart, lt: inThreeDays }, application: liveApp },
      orderBy: { scheduledStart: "asc" },
      take: 6,
      select: interviewSelect,
    }),
    // Sent, and no answer after a few days.
    prisma.offer.findMany({
      where: {
        status: "released",
        OR: [{ sentAt: { lt: replyCutoff } }, { sentAt: null, releasedAt: { lt: replyCutoff } }],
        application: liveApp,
      },
      orderBy: { releasedAt: "asc" },
      take: 50,
      select: { application: { select: { candidate: { select: { fullName: true } } } } },
    }),
    // Accepted, not yet made an employee.
    prisma.offer.count({ where: { status: "accepted", application: { ...liveApp, conversionSnapshot: null } } }),
    prisma.application.count({ where: { ...liveApp, createdAt: { gte: weekStart } } }),
    prisma.interviewFeedback.count({ where: { submittedAt: { gte: weekStart }, interview: { roundType: "hr" } } }),
    prisma.applicationStageHistory.count({ where: { toStage: "manager_round", createdAt: { gte: weekStart } } }),
    prisma.applicationStageHistory.count({ where: { toStage: "decision", createdAt: { gte: weekStart } } }),
    prisma.employeeConversionSnapshot.count({ where: { convertedAt: { gte: weekStart } } }),
  ]);

  const firstBatch = missingStars[0] ?? null;
  return {
    hireWithoutOffer: { count: hireWithoutOffer.length, names: hireWithoutOffer.slice(0, 3).map((a) => a.candidate.fullName) },
    missingHrStars: {
      count: missingStars.length,
      batchId: firstBatch?.batchId ?? null,
      batchCode: firstBatch?.batch.code ?? null,
    },
    interviewsToday: interviewsToday.map(toInterview),
    offersNoReply: { count: offersNoReply.length, names: offersNoReply.slice(0, 3).map((o) => o.application.candidate.fullName) },
    pendingConversions,
    upcoming: upcoming.map(toInterview),
    week: { added, hrRated, sentToManager, hired, joined, weekStart },
  };
}
