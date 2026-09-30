/**
 * Hiring-batch filter for the pipeline. Openings like "Senior Biller" are
 * reused for years, so HR narrows the board to one hiring round by applied
 * date. Presets are rolling windows ending today (IST) and are resolved at
 * request time, so a bookmarked "Last 7 days" link stays current; "custom"
 * uses explicit from/to days. Pure date math only — safe for client imports.
 */

export const HIRING_BATCH_PRESETS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom range…" },
] as const;

export type HiringBatch = (typeof HIRING_BATCH_PRESETS)[number]["value"];

const PRESET_VALUES = new Set<string>(HIRING_BATCH_PRESETS.map((p) => p.value));
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isHiringBatch(value: unknown): value is HiringBatch {
  return typeof value === "string" && PRESET_VALUES.has(value);
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

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return toDateOnly(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Same day-of-month N months back, clamped (31 May − 3 months → 28/29 Feb). */
function shiftMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const lastDayOfTarget = new Date(Date.UTC(y, m - 1 - months + 1, 0)).getUTCDate();
  return toDateOnly(new Date(Date.UTC(y, m - 1 - months, Math.min(d, lastDayOfTarget))));
}

export type ResolvedHiringBatch = {
  batch: HiringBatch;
  /** Inclusive YYYY-MM-DD IST day bounds passed to the application repository. */
  appliedFrom?: string;
  appliedTo?: string;
};

/**
 * Turns URL params into concrete day bounds. Bare `appliedFrom`/`appliedTo`
 * without a `batch` (links from before presets existed) count as custom.
 */
export function resolveHiringBatch(
  params: { batch?: unknown; appliedFrom?: unknown; appliedTo?: unknown },
  now: Date = new Date()
): ResolvedHiringBatch {
  const appliedFrom = parseDateOnly(params.appliedFrom);
  const appliedTo = parseDateOnly(params.appliedTo);
  const batch: HiringBatch = isHiringBatch(params.batch)
    ? params.batch
    : appliedFrom || appliedTo
      ? "custom"
      : "all";

  const today = istToday(now);
  switch (batch) {
    case "all":
      return { batch };
    case "custom":
      return { batch, appliedFrom, appliedTo };
    case "today":
      return { batch, appliedFrom: today };
    case "7d":
      return { batch, appliedFrom: shiftDays(today, -6) };
    case "30d":
      return { batch, appliedFrom: shiftDays(today, -29) };
    case "3m":
      return { batch, appliedFrom: shiftMonths(today, 3) };
    case "6m":
      return { batch, appliedFrom: shiftMonths(today, 6) };
    case "12m":
      return { batch, appliedFrom: shiftMonths(today, 12) };
  }
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Short human hint for the resolved window, e.g. "Applied 24 Sep 2026 – today". */
export function describeHiringBatch(
  resolved: ResolvedHiringBatch,
  now: Date = new Date()
): string | null {
  const { appliedFrom, appliedTo } = resolved;
  if (!appliedFrom && !appliedTo) return null;
  const today = istToday(now);
  if (appliedFrom === today && (!appliedTo || appliedTo === today)) return "Applied today";
  const end = !appliedTo || appliedTo === today ? "today" : formatDay(appliedTo);
  return appliedFrom ? `Applied ${formatDay(appliedFrom)} – ${end}` : `Applied up to ${end}`;
}
