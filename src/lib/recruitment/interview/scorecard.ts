/**
 * Post-interview scorecard: five star ratings, one verdict, remarks and an
 * optional comment to HR.
 *
 * Storage (no dedicated columns needed):
 * - star ratings → `InterviewFeedback.ratingsJson` keyed by criterion id (1-5)
 * - verdict      → `recommendation` (strong_yes | yes | no | strong_no)
 * - considered   → `consideredForPosition` (derived: yes / strong_yes)
 * - overall      → `overallRating` (derived: average of the stars)
 * - remarks      → `strengths`;  comment to HR → `privateNotes`
 * Client-safe (no server imports) so the form and views can share it.
 */

export const SCORECARD_CRITERIA = [
  {
    id: "process_knowledge",
    label: "Knowledge",
    description: "Understands the role's process, domain and tools.",
  },
  {
    id: "skills",
    label: "Skills",
    description: "Can actually do the work: hands-on ability and accuracy.",
  },
  {
    id: "communication",
    label: "Communication",
    description: "Explains clearly, listens, and needs little prompting.",
  },
  {
    id: "smartness",
    label: "Smartness",
    description: "Thinks quickly, solves problems, uses good judgement.",
  },
  {
    id: "eagerness_to_learn",
    label: "Eagerness to learn",
    description: "Curious, coachable, and keen to grow.",
  },
] as const;

export type ScorecardCriterionId = (typeof SCORECARD_CRITERIA)[number]["id"];

export type ScorecardRatings = Record<ScorecardCriterionId, number>;

export const STAR_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Below average",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

export type StarTone = "red" | "amber" | "lime" | "green";

/** 1-2 red, 3 amber, 4 light green, 5 green (averages are rounded first). */
export function starTone(value: number): StarTone {
  const v = Math.round(value);
  if (v <= 2) return "red";
  if (v === 3) return "amber";
  if (v === 4) return "lime";
  return "green";
}

export function starLabel(value: number): string {
  return STAR_LABELS[Math.min(5, Math.max(1, Math.round(value)))] ?? "";
}

export const VERDICTS = [
  { value: "strong_no", label: "Strong No", positive: false },
  { value: "no", label: "No", positive: false },
  { value: "yes", label: "Yes", positive: true },
  { value: "strong_yes", label: "Strong Yes", positive: true },
] as const;

export type Verdict = (typeof VERDICTS)[number]["value"];

export const VERDICT_VALUES = VERDICTS.map((v) => v.value) as [Verdict, ...Verdict[]];

/** Older scorecards stored a 5-level hire recommendation; map it for display. */
const LEGACY_VERDICT: Record<string, Verdict> = {
  strong_hire: "strong_yes",
  hire: "yes",
  lean_hire: "yes",
  no_hire: "no",
  strong_no_hire: "strong_no",
};

export function normalizeVerdict(value: string | null | undefined): Verdict | null {
  if (!value) return null;
  if ((VERDICT_VALUES as readonly string[]).includes(value)) return value as Verdict;
  return LEGACY_VERDICT[value] ?? null;
}

export function verdictLabel(value: string | null | undefined): string | null {
  const v = normalizeVerdict(value);
  return v ? (VERDICTS.find((x) => x.value === v)?.label ?? null) : null;
}

export function isPositiveVerdict(value: string | null | undefined): boolean {
  const v = normalizeVerdict(value);
  return v === "yes" || v === "strong_yes";
}

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
