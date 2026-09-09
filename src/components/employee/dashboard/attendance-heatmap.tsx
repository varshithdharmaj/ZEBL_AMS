"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarOff,
  Check,
  CircleAlert,
  Info,
  Palmtree,
  Star,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, minutesToHours, toISODate } from "@/lib/utils";
import { calculateStreaks } from "@/lib/attendance/streak-calculator";
import {
  isWorkedDayCategory,
  type AttendanceDayResult,
} from "@/lib/attendance/day-classification";
import type { AttendanceHeatmapMonth } from "@/lib/attendance/heatmap-data";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  HEATMAP_COLOR,
  RATIO_TIER_COLOR,
  TIER_TAG_LABEL,
  heatmapCellForeground,
} from "@/lib/attendance/day-labels";
import {
  buildHeatmapMonthStats,
  buildHeatmapCycleStats,
  monthKeyFromDate,
  cycleKeyFromDate,
  type HeatmapMonthStats,
} from "@/lib/attendance/heatmap-month-stats";
import { formatAttendanceCycleLabel } from "@/lib/attendance/attendance-cycle";

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/** Preserve footprint: 26px cells, 3px gaps (Phase 8C). */
const CELL = 26;
const GAP = 3;
const STEP = CELL + GAP;
const MONTH_LABEL_ROW = 18;

/** Weekday rows (0=Sun..6=Sat, top to bottom) whose upward-popping tooltip (the
 *  default) doesn't reliably fit above the row before hitting the card's own
 *  clipped edge (SectionCard's overflow-hidden, compounded by the grid's
 *  overflow-x-auto scroll wrapper implicitly clipping overflow-y too) — a tall
 *  multi-line tooltip on these rows instead opens downward. */
const TOOLTIP_FLIP_ROW_COUNT = 2;

// useLayoutEffect warns "does nothing on the server" when it runs during SSR — this
// component is server-rendered before hydration, so fall back to useEffect there (a
// no-op either way, since there's no DOM to measure) and only use the real
// useLayoutEffect once running in the browser.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function isWorkedCategory(category: AttendanceDayResult["category"]): boolean {
  return isWorkedDayCategory(category);
}

/**
 * An active hover/focus interaction always wins over a pinned month. The pin
 * is only a fallback once hoveredMonthKey is genuinely null — no pointer/focus
 * interaction owns a specific month. hoveredMonthKey is cleared by: the wrapper's
 * onMouseLeave, `shouldClearHoverOnFocusOut` (focus leaving the wrapper), and
 * hovering a grid position that owns no month (a blank range-boundary cell or an
 * unlabeled week-header slot) — every hoverable surface in the wrapper has
 * well-defined hover behavior, so hoveredMonthKey can never get "stuck" showing a
 * month the pointer isn't actually over.
 */
export function resolveActiveMonthKey(
  hoveredMonthKey: string | null,
  pinnedMonthKey: string | null
): string | null {
  return hoveredMonthKey ?? pinnedMonthKey;
}

/** Click-to-pin toggles: clicking the already-pinned month unpins it. */
export function nextPinnedMonthKey(
  currentPinnedMonthKey: string | null,
  clickedMonthKey: string
): string | null {
  return currentPinnedMonthKey === clickedMonthKey ? null : clickedMonthKey;
}

/**
 * Keyboard focus can leave the interactive wrapper without any mouse event
 * ever firing (e.g. Tab past the last cell to the next section). Without this,
 * hoveredMonthKey could stay stuck on the last-focused month indefinitely,
 * permanently shadowing the pinned fallback. `relatedTarget` is the element
 * gaining focus; if it's outside the wrapper, the interaction has genuinely ended.
 */
export function shouldClearHoverOnFocusOut(
  container: { contains(node: Node | null): boolean },
  relatedTarget: Node | null
): boolean {
  return !container.contains(relatedTarget);
}

export function getCellColor(day: AttendanceDayResult): string {
  if (isWorkedDayCategory(day.category) && day.ratioTier) {
    return RATIO_TIER_COLOR[day.ratioTier];
  }
  return CATEGORY_COLOR[day.category] ?? HEATMAP_COLOR.empty;
}

export function buildTooltipText(
  day: AttendanceDayResult,
  expectedWorkMinutes: number,
  isFuture = false
): string {
  const dateLabel = day.date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Future dates never show a category (absent/leave/holiday) — there's nothing to
  // report yet, and showing one would misleadingly imply a known outcome.
  if (isFuture) return `${dateLabel} · Upcoming`;

  // CATEGORY_LABEL already reads "Regularised" for this category — the primary status
  // label needs no special-casing here.
  const parts = [`${dateLabel}`, CATEGORY_LABEL[day.category]];
  const isRegularised = day.category === "REGULARISED";

  if (isWorkedDayCategory(day.category)) {
    // HR already reviewed and approved this day — never tack on a "Below target" /
    // "Near target" / short-hours tier tag alongside "Regularised"; the tag would read
    // as a penalty on a day that was explicitly corrected and signed off.
    if (day.ratioTier && !isRegularised) {
      // Exactly one tag per tier — see TIER_TAG_LABEL's own doc comment for why this
      // must never be combined with a second, possibly-contradictory tier label.
      parts.push(TIER_TAG_LABEL[day.ratioTier]);
    }
    parts.push(
      isRegularised
        ? `Worked: ${minutesToHours(day.workedMinutes)} (Regularised)`
        : `Worked: ${minutesToHours(day.workedMinutes)}`
    );
    if (expectedWorkMinutes > 0) parts.push(`Expected: ${minutesToHours(expectedWorkMinutes)}`);
    if (day.overtimeMinutes > 0) parts.push(`Overtime: ${minutesToHours(day.overtimeMinutes)}`);
    if (day.checkIn) parts.push(`Check-in: ${day.checkIn}`);
    if (day.checkOut) parts.push(`Check-out: ${day.checkOut}`);
  }
  if (day.category === "HOLIDAY" || day.category === "WORKED_ON_HOLIDAY") {
    if (day.holidayName) parts.push(`Holiday: ${day.holidayName}`);
  }
  if (day.category === "LEAVE" && day.leaveType) {
    parts.push(`Leave type: ${day.leaveType}`);
  }
  // Internal ingestion/derivation tags (e.g. "Biometric Device Ingestion", "Live
  // check-in") are plumbing, not information for the employee — only a human-authored
  // remark is ever worth surfacing here.
  if (day.remark && !day.remarkIsSystemGenerated) parts.push(`Remarks: ${day.remark}`);
  if (day.category === "INSUFFICIENT_DATA") {
    parts.push("Reach out to HR if this looks incorrect");
  }
  if (day.hasLeaveConflict) {
    parts.push("Attendance recorded on an approved leave date.");
  }

  return parts.join(" · ");
}

function ContributionCell({
  day,
  expectedWorkMinutes,
  isSelected,
  isToday,
  isFuture,
  dimmed,
  href,
  groupKey,
  tooltipBelow,
  onMonthIntent,
}: {
  day: AttendanceDayResult;
  expectedWorkMinutes: number;
  isSelected: boolean;
  isToday: boolean;
  isFuture: boolean;
  dimmed: boolean;
  href: string;
  /** This day's group key under the active hover mode (calendar month or attendance cycle). */
  groupKey: string;
  /** True for cells in the top weekday rows, where a multi-line tooltip popping
   *  upward (the default) doesn't fit before it hits the card's own clipped edge —
   *  see TOOLTIP_FLIP_ROW_COUNT. */
  tooltipBelow: boolean;
  onMonthIntent: (groupKey: string | null) => void;
}) {
  // Upcoming dates always render as the neutral "empty" swatch — the classifier's
  // category (which may say ABSENT/LEAVE/HOLIDAY) describes a day that hasn't happened.
  const color = isFuture ? HEATMAP_COLOR.empty : getCellColor(day);
  const fg = isFuture
    ? HEATMAP_COLOR.cellFg
    : heatmapCellForeground(isWorkedDayCategory(day.category) ? day.ratioTier : null);
  const tooltip = buildTooltipText(day, expectedWorkMinutes, isFuture);
  const dateNum = day.date.getDate();

  return (
    <div
      className="group relative"
      data-month={groupKey}
      onMouseEnter={() => onMonthIntent(groupKey)}
      onFocusCapture={() => onMonthIntent(groupKey)}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "relative flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border border-black/5 transition-[opacity,box-shadow,background-color] duration-150 dark:border-white/10",
          "hover:z-10 hover:ring-2 hover:ring-primary/35",
          "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "motion-reduce:transition-none",
          isSelected && "z-10 ring-2 ring-primary",
          isToday && !isSelected && "z-[1] ring-2 ring-foreground/55 ring-offset-1 ring-offset-card",
          dimmed && "opacity-35"
        )}
        style={{ backgroundColor: color, color: fg }}
        aria-label={isSelected ? `${tooltip} · Selected` : tooltip}
        aria-current={isSelected ? "date" : isToday ? "date" : undefined}
      >
        <span className="select-none text-[0.5rem] font-semibold tabular-nums opacity-90">
          {dateNum}
        </span>
      </Link>

      <div
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute left-1/2 z-30 w-max max-w-xs -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground opacity-0 shadow-elevated transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100",
          tooltipBelow ? "top-full mt-2" : "bottom-full mb-2"
        )}
      >
        {tooltip}
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[3px] border border-black/5 dark:border-white/10",
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function HeatmapLegend() {
  return (
    <div className="mt-2 grid gap-6 border-t border-border pt-2 sm:grid-cols-3">
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Attendance
        </h4>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.present} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Check className="h-3 w-3 text-muted-foreground" aria-hidden />
                Below target
              </div>
              <p className="text-muted-foreground">Attended, under expected hours</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.excellent} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Star className="h-3 w-3 text-muted-foreground" aria-hidden />
                Excellent
              </div>
              <p className="text-muted-foreground">Attended, met or exceeded expected hours</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.absent} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <X className="h-3 w-3 text-muted-foreground" aria-hidden />
                Absent
              </div>
              <p className="text-muted-foreground">Expected working day, no attendance</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.leave} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CalendarOff className="h-3 w-3 text-muted-foreground" aria-hidden />
                Leave
              </div>
              <p className="text-muted-foreground">Approved leave</p>
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Context
        </h4>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.holiday} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Palmtree className="h-3 w-3 text-muted-foreground" aria-hidden />
                Holiday
              </div>
              <p className="text-muted-foreground">Organisation holiday</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.weeklyOff} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CalendarOff className="h-3 w-3 text-muted-foreground" aria-hidden />
                Weekly off
              </div>
              <p className="text-muted-foreground">Scheduled non-working day</p>
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Needs attention
        </h4>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.insufficient} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CircleAlert className="h-3 w-3 text-muted-foreground" aria-hidden />
                Insufficient data
              </div>
              <p className="text-muted-foreground">Check-in without usable duration</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

const SUMMARY_TILE_STYLE: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  emeraldStrong: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
};

function SummaryStatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof SUMMARY_TILE_STYLE;
}) {
  return (
    <div className={cn("rounded-lg px-3 py-2", SUMMARY_TILE_STYLE[tone])}>
      <p className="text-[0.65rem] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Semi-circle radial gauge: a 180° arc traced by stroke-dasharray, filled proportionally to `percent`. */
function RadialAttendanceGauge({ percent }: { percent: number | null }) {
  const radius = 70;
  const circumference = Math.PI * radius;
  const clamped = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const filled = (clamped / 100) * circumference;

  return (
    <div className="relative mx-auto flex w-full max-w-[200px] flex-col items-center">
      <svg viewBox="0 0 160 90" className="w-full overflow-visible">
        <path
          d="M10 85 A70 70 0 0 1 150 85"
          fill="none"
          stroke="currentColor"
          strokeWidth={12}
          strokeLinecap="round"
          className="text-muted/40"
        />
        <path
          d="M10 85 A70 70 0 0 1 150 85"
          fill="none"
          stroke="currentColor"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="text-primary transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="-mt-8 text-center">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {percent != null ? `${percent}%` : "—"}
        </p>
        <p className="text-[0.65rem] text-muted-foreground">Total attendance</p>
      </div>
    </div>
  );
}

function AttendanceSummaryPanel({ stats }: { stats: HeatmapMonthStats | null }) {
  const avg =
    stats?.averageWorkedMinutes != null ? minutesToHours(stats.averageWorkedMinutes) : "—";

  return (
    <div className="w-full shrink-0 rounded-xl border border-border/60 bg-slate-50/60 p-4 shadow-sm dark:bg-slate-900/40 lg:w-80">
      <p className="text-sm font-semibold text-foreground">
        {stats ? `${stats.label} summary` : "Summary"}
      </p>

      <div className="mt-2">
        <RadialAttendanceGauge percent={stats?.attendancePercent ?? null} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <SummaryStatTile label="Present" value={String(stats?.presentDays ?? 0)} tone="emerald" />
        <SummaryStatTile
          label="Excellent"
          value={String(stats?.excellentDays ?? 0)}
          tone="emeraldStrong"
        />
        <SummaryStatTile label="Absent" value={String(stats?.absentDays ?? 0)} tone="rose" />
        <SummaryStatTile label="Leave" value={String(stats?.leaveDays ?? 0)} tone="amber" />
        <SummaryStatTile label="Avg hours" value={avg} tone="slate" />
        <SummaryStatTile
          label="Below target"
          value={String(stats?.belowTargetDays ?? 0)}
          tone="slate"
        />
      </div>
    </div>
  );
}

function AttendanceHeatmapErrorNotice() {
  return (
    <SectionCard title="Attendance activity" description="Daily working-hour effectiveness for the current attendance cycle.">
      <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning-muted px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load the attendance heatmap</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The rest of your dashboard is unaffected.</p>
        </div>
      </div>
    </SectionCard>
  );
}

export function AttendanceHeatmapSkeleton() {
  return (
    <section aria-hidden className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="mb-4 h-4 w-72" />
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-[26px] w-[26px] rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="mt-6 h-32 w-full" />
    </section>
  );
}

function organizeIntoWeeks(days: AttendanceDayResult[]): (AttendanceDayResult | null)[][] {
  if (days.length === 0) return [];

  const weeks: (AttendanceDayResult | null)[][] = [];
  let currentWeek: (AttendanceDayResult | null)[] = Array(7).fill(null);
  let weekStarted = false;

  days.forEach((day) => {
    const dayOfWeek = day.date.getDay();

    if (dayOfWeek === 0 && weekStarted) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }

    currentWeek[dayOfWeek] = day;
    weekStarted = true;
  });

  if (currentWeek.some((d) => d !== null)) {
    weeks.push(currentWeek);
  }

  return weeks;
}

function getMonthLabels(weeks: (AttendanceDayResult | null)[][]): { label: string; weekIndex: number; monthKey: string }[] {
  const labels: { label: string; weekIndex: number; monthKey: string }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;

    const month = firstDay.date.getMonth();
    const year = firstDay.date.getFullYear();

    if (month !== lastMonth) {
      const monthName = firstDay.date.toLocaleDateString("en-IN", { month: "short" });
      const label = weekIndex === 0 ? `${monthName} ${year}` : monthName;
      labels.push({ label, weekIndex, monthKey: monthKeyFromDate(firstDay.date) });
      lastMonth = month;
    }
  });

  return labels;
}

function cycleShortLabel(cycleKey: string, includeYear: boolean): string {
  const [y, m, d] = cycleKey.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const monthName = date.toLocaleDateString("en-IN", { month: "short" });
  return includeYear ? `${d} ${monthName} ${y}` : `${d} ${monthName}`;
}

/** Cycle-mode analogue of getMonthLabels — a cycle's 25th anchor rarely lands on a
 *  week boundary, so (unlike months) a week can straddle two cycles; scanning every
 *  day in date order (not just each week's first day) catches the transition wherever
 *  in the week it actually falls. */
function getCycleLabels(weeks: (AttendanceDayResult | null)[][]): { label: string; weekIndex: number; monthKey: string }[] {
  const labels: { label: string; weekIndex: number; monthKey: string }[] = [];
  let lastCycleKey: string | null = null;

  weeks.forEach((week, weekIndex) => {
    for (const day of week) {
      if (!day) continue;
      const key = cycleKeyFromDate(day.date);
      if (key !== lastCycleKey) {
        labels.push({ label: cycleShortLabel(key, labels.length === 0), weekIndex, monthKey: key });
        lastCycleKey = key;
      }
    }
  });

  return labels;
}

export function AttendanceHeatmap({ month }: { month: AttendanceHeatmapMonth | null }) {
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date");
  const today = useMemo(() => new Date(), []);

  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [pinnedMonthKey, setPinnedMonthKey] = useState<string | null>(null);
  /** Grouping unit for hover/pin/summary: calendar month (default) or 25th-to-25th
   *  attendance cycle. Switching modes clears any active hover/pin so a key from one
   *  scheme is never looked up against the other's stats map. */
  const [groupBy, setGroupBy] = useState<"month" | "cycle">("month");
  const groupKeyFromDate = groupBy === "month" ? monthKeyFromDate : cycleKeyFromDate;

  const activeMonthKey = resolveActiveMonthKey(hoveredMonthKey, pinnedMonthKey);

  // Scroll position only, never the data range: the heatmap still fetches/renders the
  // full Jan 1 → today span (see heatmap-data.ts); this just moves the *viewport* over
  // that unchanged content so the most recent ~4 months are visible without the user
  // having to scroll manually every time.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasSetInitialScroll = useRef(false);

  const derived = useMemo(() => {
    if (!month) return null;
    const weeks = organizeIntoWeeks(month.days);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // Hover-month stats must never count future dates as absent — only classify
    // what's actually happened so far this cycle.
    const relevantDays = month.days.filter((d) => d.date <= todayMidnight);
    return {
      streaks: calculateStreaks(relevantDays, today),
      weeks,
      monthLabels: groupBy === "month" ? getMonthLabels(weeks) : getCycleLabels(weeks),
      monthStats: groupBy === "month" ? buildHeatmapMonthStats(relevantDays) : buildHeatmapCycleStats(relevantDays),
      todayMidnight,
    };
  }, [month, today, groupBy]);

  function handleGroupByChange(next: "month" | "cycle") {
    if (next === groupBy) return;
    setGroupBy(next);
    // A hovered/pinned key from one scheme is meaningless against the other's stats
    // map — start clean rather than showing a stale or mismatched summary.
    setHoveredMonthKey(null);
    setPinnedMonthKey(null);
  }

  // Runs once, after layout, to land the viewport on the latest data instead of Jan 1.
  // Guarded by hasSetInitialScroll so later re-renders (hover, pin, selecting a
  // different day) never yank the scroll position back — only the very first
  // successful measurement ever moves it. Derived from the container's actual
  // scrollWidth/clientWidth (not a hard-coded pixel offset or month count), so it
  // adapts to however wide the rendered range and viewport actually are; when there's
  // nothing to scroll (e.g. only a few months of data), the clamp below is a no-op.
  useIsomorphicLayoutEffect(() => {
    if (hasSetInitialScroll.current) return;
    const el = scrollContainerRef.current;
    if (!el || !derived) return;

    el.scrollLeft = el.scrollWidth - el.clientWidth;
    hasSetInitialScroll.current = true;
  }, [derived]);

  const searchParamsString = searchParams.toString();
  const cellHref = useMemo(() => {
    return (day: AttendanceDayResult): string => {
      const params = new URLSearchParams(searchParamsString);
      params.set("date", toISODate(day.date));
      return `/employee/dashboard?${params.toString()}`;
    };
  }, [searchParamsString]);

  if (!month || !derived) {
    return <AttendanceHeatmapErrorNotice />;
  }

  const { streaks, weeks, monthLabels, monthStats, todayMidnight } = derived;
  const { currentStreak, bestStreak, targetDaysCount } = streaks;
  const activeStats = activeMonthKey ? monthStats.get(activeMonthKey) ?? null : null;
  const currentMonthKey = groupKeyFromDate(today);
  const latestMonthLabel = monthLabels[monthLabels.length - 1] ?? null;
  const summaryStats =
    activeStats ??
    monthStats.get(currentMonthKey) ??
    (latestMonthLabel ? monthStats.get(latestMonthLabel.monthKey) ?? null : null);
  const cycleLabel = formatAttendanceCycleLabel({
    startDate: month.cycleStartDate,
    endDate: month.cycleEndDate,
    dates: [],
  });

  return (
    <SectionCard
      title="Attendance activity"
      description={`Daily working-hour effectiveness over the current year · current cycle: ${cycleLabel}`}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Hover a {groupBy === "month" ? "month" : "cycle"} for summary · click a day to select</span>
          </div>
          <div
            role="group"
            aria-label="Group summary by"
            className="inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5 text-xs"
          >
            {(["month", "cycle"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={groupBy === option}
                onClick={() => handleGroupByChange(option)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium capitalize transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  groupBy === option
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="w-full flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{targetDaysCount} excellent days</span>
            <span aria-hidden>·</span>
            <span>{currentStreak}-day streak</span>
            <span aria-hidden>·</span>
            <span>Best {bestStreak} days</span>
          </div>

          <div
            onMouseLeave={() => setHoveredMonthKey(null)}
            onBlur={(event) => {
              if (shouldClearHoverOnFocusOut(event.currentTarget, event.relatedTarget)) {
                setHoveredMonthKey(null);
              }
            }}
          >
            <div ref={scrollContainerRef} className="overflow-x-auto pb-2">
              <div className="relative inline-flex flex-col gap-[3px]">
              <div className="relative z-[1] flex items-center gap-[3px] pl-9" style={{ minHeight: MONTH_LABEL_ROW }}>
                {weeks.map((_, weekIndex) => {
                  const label = monthLabels.find((m) => m.weekIndex === weekIndex);
                  return (
                    <div
                      key={weekIndex}
                      className="w-[26px] text-left"
                      // Unlabeled weeks own no month — hovering them shouldn't leave
                      // hoveredMonthKey stuck on whatever was last actively hovered.
                      onMouseEnter={label ? undefined : () => setHoveredMonthKey(null)}
                    >
                      {label && (
                        <button
                          type="button"
                          className={cn(
                            "whitespace-nowrap text-[0.625rem] font-medium text-muted-foreground transition-colors",
                            "hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            activeMonthKey === label.monthKey && "text-foreground"
                          )}
                          onMouseEnter={() => setHoveredMonthKey(label.monthKey)}
                          onFocus={() => setHoveredMonthKey(label.monthKey)}
                          onClick={() =>
                            setPinnedMonthKey((prev) => nextPinnedMonthKey(prev, label.monthKey))
                          }
                          aria-pressed={pinnedMonthKey === label.monthKey}
                          aria-label={`${label.label} summary`}
                        >
                          {label.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                // hover:z-20/focus-within:z-20 lifts this row's whole stacking context above
                // its neighbors (each row is its own context via relative+z-index, so equal
                // z-index would otherwise paint in DOM order) — without it, a hovered cell's
                // tooltip that opens into an adjacent row (e.g. the flip-below rows near the
                // grid top) renders underneath that row's cells instead of over them.
                <div
                  key={dayIndex}
                  className="relative z-[1] flex items-center gap-[3px] hover:z-20 focus-within:z-20"
                >
                  <div className="w-8 pr-1 text-right">
                    <span className="text-[0.625rem] font-medium text-muted-foreground">
                      {WEEKDAY_LABELS[dayIndex]}
                    </span>
                  </div>

                  {weeks.map((week, weekIndex) => {
                    const day = week[dayIndex];
                    if (!day) {
                      // No day at this grid position (range boundary) — owns no month,
                      // so hovering it must not leave a stale month summary showing.
                      return (
                        <div
                          key={weekIndex}
                          className="h-[26px] w-[26px]"
                          onMouseEnter={() => setHoveredMonthKey(null)}
                        />
                      );
                    }

                    const dayStr = toISODate(day.date);
                    const isSelected = selectedDate === dayStr;
                    const isToday =
                      day.date.getDate() === today.getDate() &&
                      day.date.getMonth() === today.getMonth() &&
                      day.date.getFullYear() === today.getFullYear();
                    const isFuture = day.date > todayMidnight;
                    const dayGroupKey = groupKeyFromDate(day.date);
                    const dimmed = Boolean(activeMonthKey && dayGroupKey !== activeMonthKey);

                    return (
                      <ContributionCell
                        key={`${weekIndex}-${dayIndex}`}
                        day={day}
                        expectedWorkMinutes={month.expectedWorkMinutes}
                        isSelected={isSelected}
                        isToday={isToday}
                        isFuture={isFuture}
                        dimmed={dimmed}
                        href={cellHref(day)}
                        groupKey={dayGroupKey}
                        tooltipBelow={dayIndex < TOOLTIP_FLIP_ROW_COUNT}
                        onMonthIntent={setHoveredMonthKey}
                      />
                    );
                  })}
                </div>
              ))}
              </div>
            </div>
          </div>

          {month.days.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">No days to show for this period.</p>
          )}

          <HeatmapLegend />
        </div>

        <AttendanceSummaryPanel stats={summaryStats} />
      </div>
    </SectionCard>
  );
}
