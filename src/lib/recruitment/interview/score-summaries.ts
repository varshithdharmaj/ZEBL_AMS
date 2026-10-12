import { prisma } from "@/lib/prisma";
import {
  SCORECARD_CRITERIA,
  normalizeVerdict,
  readScorecardRatings,
  type ScorecardRatings,
  type Verdict,
} from "@/lib/recruitment/interview/scorecard";

/** Per-application roll-up for the spreadsheet-style list columns. */
export type ApplicationScoreSummary = {
  scorecards: number;
  /** Average stars per criterion across all interviewers and rounds. */
  averages: Partial<ScorecardRatings>;
  verdicts: Partial<Record<Verdict, number>>;
  offer: { status: string; negotiationStatus: string | null; followUpAt: string | null } | null;
};

/**
 * One query each for scorecards and offers across a page of applications
 * (not one per row), so the list stays fast.
 */
export async function loadApplicationScoreSummaries(
  applicationIds: readonly string[]
): Promise<Record<string, ApplicationScoreSummary>> {
  const ids = [...new Set(applicationIds)];
  if (ids.length === 0) return {};

  const [feedback, offers] = await Promise.all([
    prisma.interviewFeedback.findMany({
      where: { interview: { applicationId: { in: ids } }, submittedAt: { not: null } },
      select: {
        ratingsJson: true,
        recommendation: true,
        consideredForPosition: true,
        interview: { select: { applicationId: true } },
      },
    }),
    prisma.offer.findMany({
      where: { applicationId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { applicationId: true, status: true, negotiationStatus: true, negotiationFollowUpAt: true },
    }),
  ]);

  const out: Record<string, ApplicationScoreSummary> = {};
  const sums: Record<string, Record<string, { total: number; count: number }>> = {};
  for (const id of ids) {
    out[id] = { scorecards: 0, averages: {}, verdicts: {}, offer: null };
    sums[id] = {};
  }

  for (const f of feedback) {
    const appId = f.interview.applicationId;
    const summary = out[appId];
    if (!summary) continue;
    summary.scorecards += 1;
    const ratings = readScorecardRatings(f.ratingsJson);
    for (const c of SCORECARD_CRITERIA) {
      const v = ratings[c.id];
      if (v === undefined) continue;
      const acc = (sums[appId][c.id] ??= { total: 0, count: 0 });
      acc.total += v;
      acc.count += 1;
    }
    const verdict =
      normalizeVerdict(f.recommendation) ??
      (f.consideredForPosition == null ? null : f.consideredForPosition ? "yes" : "no");
    if (verdict) summary.verdicts[verdict] = (summary.verdicts[verdict] ?? 0) + 1;
  }

  for (const id of ids) {
    for (const [criterion, acc] of Object.entries(sums[id])) {
      out[id].averages[criterion as keyof ScorecardRatings] = Math.round((acc.total / acc.count) * 10) / 10;
    }
  }

  for (const o of offers) {
    const summary = out[o.applicationId];
    if (summary && !summary.offer) {
      summary.offer = {
        status: o.status,
        negotiationStatus: o.negotiationStatus,
        followUpAt: o.negotiationFollowUpAt?.toISOString() ?? null,
      };
    }
  }

  return out;
}
