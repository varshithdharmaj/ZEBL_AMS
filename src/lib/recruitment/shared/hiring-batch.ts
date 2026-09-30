/**
 * Hiring-batch filter for the pipeline. Openings like "Senior Biller" are
 * reused for years, so HR narrows the board to one hiring round by applied
 * date. Quick picks are resolved against today's IST date on every request,
 * so a bookmarked "Last 7 days" link stays current; "custom" carries explicit
 * from/to days picked on the calendar. Pure date math — safe for client imports.
 */

export const HIRING_BATCH_QUICK_PICKS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3m", label: "Last 3 months" },
  { value: "this-year", label: "This year" },
] as const;

export type HiringBatchQuickPick = (typeof HIRING_BATCH_QUICK_PICKS)[number]["value"];
export type HiringBatch = HiringBatchQuickPick | "custom";

const BATCH_VALUES = new Set<string>([...HIRING_BATCH_QUICK_PICKS.map((p) => p.value), "custom"]);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isHiringBatch(value: unknown): value is HiringBatch {
  return typeof value === "string" && BATCH_VALUES.has(value);
}

export function parseDateOnly(raw: unknown): string | undefined {
  return typeof raw === "string" && DATE_ONLY_PATTERN.test(raw) ? raw : undefined;
}

/** Today's calendar date in IST as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function utcDay(y: number, monthIndex: number, d: number): string {
  return new Date(Date.UTC(y, monthIndex, d)).toISOString().slice(0, 10);
}

function shiftDays(day: string, days: number): string {
  const [y, m, d] = parts(day);
  return utcDay(y, m - 1, d + days);
}

/** Same day-of-month N months back, clamped (31 May − 3 months → 28/29 Feb). */
function shiftMonths(day: string, months: number): string {
  const [y, m, d] = parts(day);
  const lastDayOfTarget = new Date(Date.UTC(y, m - months, 0)).getUTCDate();
  return utcDay(y, m - 1 - months, Math.min(d, lastDayOfTarget));
}

/** Inclusive IST day bounds for a quick pick, or null for "all". */
export function quickPickRange(
  pick: HiringBatchQuickPick,
  now: Date = new Date()
): { from: string; to: string } | null {
  const today = istToday(now);
  const [y, m] = parts(today);
  switch (pick) {
    case "all":
      return null;
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: shiftDays(today, -6), to: today };
    case "this-month":
      return { from: utcDay(y, m - 1, 1), to: today };
    case "last-month":
      return { from: utcDay(y, m - 2, 1), to: utcDay(y, m - 1, 0) };
    case "3m":
      return { from: shiftMonths(today, 3), to: today };
    case "this-year":
      return { from: utcDay(y, 0, 1), to: today };
  }
}

export type ResolvedHiringBatch = {
  batch: HiringBatch;
  /** Inclusive YYYY-MM-DD IST day bounds passed to the application repository. */
  appliedFrom?: string;
  appliedTo?: string;
};

/**
 * Turns URL params into concrete day bounds. Bare `appliedFrom`/`appliedTo`
 * without a `batch` (links from the first version of this filter) count as
 * custom; an unknown batch falls back to all time.
 */
export function resolveHiringBatch(
  params: { batch?: unknown; appliedFrom?: unknown; appliedTo?: unknown },
  now: Date = new Date()
): ResolvedHiringBatch {
  const appliedFrom = parseDateOnly(params.appliedFrom);
  const appliedTo = parseDateOnly(params.appliedTo);
  const batch: HiringBatch = isHiringBatch(params.batch)
    ? params.batch
    : params.batch === undefined && (appliedFrom || appliedTo)
      ? "custom"
      : "all";

  if (batch === "custom") {
    if (!appliedFrom && !appliedTo) return { batch: "all" };
    return { batch, appliedFrom, appliedTo };
  }
  const range = quickPickRange(batch, now);
  return range ? { batch, appliedFrom: range.from, appliedTo: range.to } : { batch };
}
