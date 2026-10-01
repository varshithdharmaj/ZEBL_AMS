/**
 * Post-interview scorecard: the criteria every interviewer rates, plus the
 * "can be considered for the position" verdict.
 *
 * Criterion scores are persisted in `InterviewFeedback.ratingsJson` keyed by
 * criterion id; the verdict lives in `InterviewFeedback.consideredForPosition`.
 * Client-safe (no server imports) so the form and detail views can share it.
 */

export const SCORECARD_CRITERIA = [
  {
    id: "communication",
    label: "Communication",
    description: "Clarity, listening, and how well ideas are articulated.",
  },
  {
    id: "process_knowledge",
    label: "Knowledge on the Process",
    description: "Understanding of the role's process, domain, and tools.",
  },
  {
    id: "smartness",
    label: "Smartness",
    description: "Problem solving, quick thinking, and sound judgement.",
  },
  {
    id: "eagerness_to_learn",
    label: "Eagerness to Learn",
    description: "Curiosity, coachability, and drive to grow.",
  },
] as const;

export type ScorecardCriterionId = (typeof SCORECARD_CRITERIA)[number]["id"];

export type ScorecardRatings = Record<ScorecardCriterionId, number>;

export const SCORECARD_SCALE = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Below Average" },
  { value: 3, label: "Average" },
  { value: 4, label: "Good" },
  { value: 5, label: "Excellent" },
] as const;

export function scorecardScaleLabel(value: number): string {
  return SCORECARD_SCALE.find((s) => s.value === Math.round(value))?.label ?? "";
}

/** Recommendations that contradict a "Yes, can be considered" verdict (and vice versa). */
export const NEGATIVE_RECOMMENDATIONS = ["no_hire", "strong_no_hire"] as const;
export const POSITIVE_RECOMMENDATIONS = ["strong_hire", "hire"] as const;

/**
 * Reads the scorecard criteria out of a stored `ratingsJson` value. Unknown
 * keys (legacy/demo data) are ignored; missing criteria are omitted.
 */
export function readScorecardRatings(value: unknown): Partial<ScorecardRatings> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Partial<ScorecardRatings> = {};
  for (const c of SCORECARD_CRITERIA) {
    const raw = (value as Record<string, unknown>)[c.id];
    if (typeof raw === "number" && Number.isFinite(raw)) out[c.id] = raw;
  }
  return out;
}

/** Average of the criteria present, rounded to one decimal; null when none are rated. */
export function scorecardAverage(ratings: Partial<ScorecardRatings>): number | null {
  const values = Object.values(ratings).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
