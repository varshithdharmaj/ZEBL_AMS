"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar, type CalendarRange } from "@/components/ui/calendar";
import { Popover } from "@/components/ui/popover";
import { Sheet } from "@/components/ui/sheet";
import { formatDateRangeLabel } from "@/lib/date-range";
import {
  HIRING_BATCH_QUICK_PICKS,
  istToday,
  resolveHiringBatch,
  type HiringBatch,
  type HiringBatchQuickPick,
} from "@/lib/recruitment/shared/hiring-batch";
import { cn } from "@/lib/utils";

export type HiringBatchValue = {
  batch: HiringBatch;
  /** Only meaningful for batch === "custom". */
  appliedFrom?: string;
  appliedTo?: string;
};

function monthOf(day: string | undefined): Date {
  const [y, m] = (day ?? istToday()).split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/**
 * Hiring-batch picker: quick picks on the left apply in one click, the range
 * calendar on the right applies on "Apply". Popover on desktop, sheet on phones
 * — same interaction as the attendance DateRangeFilter.
 */
export function HiringBatchPicker({
  value,
  onChange,
}: {
  value: HiringBatchValue;
  onChange: (next: HiringBatchValue) => void;
}) {
  const resolved = resolveHiringBatch(value);
  const appliedRange: CalendarRange = { from: resolved.appliedFrom, to: resolved.appliedTo };

  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarRange>(appliedRange);
  const [month, setMonth] = useState<Date>(() => monthOf(appliedRange.to ?? appliedRange.from));

  const isActive = resolved.batch !== "all";
  const pickLabel =
    resolved.batch === "custom"
      ? "Custom"
      : (HIRING_BATCH_QUICK_PICKS.find((p) => p.value === resolved.batch)?.label ?? "All time");
  const rangeLabel =
    resolved.appliedFrom && resolved.appliedTo
      ? formatDateRangeLabel(resolved.appliedFrom, resolved.appliedTo)
      : resolved.appliedFrom
        ? `From ${formatDateRangeLabel(resolved.appliedFrom, resolved.appliedFrom)}`
        : resolved.appliedTo
          ? `Until ${formatDateRangeLabel(resolved.appliedTo, resolved.appliedTo)}`
          : null;

  function openPanel() {
    setDraft(appliedRange);
    setMonth(monthOf(appliedRange.to ?? appliedRange.from));
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
      setMobileOpen(true);
    } else {
      setOpen(true);
    }
  }

  function close() {
    setOpen(false);
    setMobileOpen(false);
  }

  function applyQuickPick(pick: HiringBatchQuickPick) {
    close();
    onChange({ batch: pick });
  }

  function applyCustom() {
    if (!draft.from) return;
    close();
    onChange({ batch: "custom", appliedFrom: draft.from, appliedTo: draft.to ?? draft.from });
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-10 w-full justify-start gap-2 bg-background px-3 font-normal",
        isActive && "pr-9"
      )}
      aria-haspopup="dialog"
      aria-expanded={open || mobileOpen}
      aria-label={`Applied date: ${pickLabel}${rangeLabel ? `, ${rangeLabel}` : ""}`}
      onClick={() => (open || mobileOpen ? close() : openPanel())}
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left text-sm">
        <span className="font-medium text-foreground">{pickLabel}</span>
        {rangeLabel ? <span className="text-muted-foreground"> · {rangeLabel}</span> : null}
      </span>
      {!isActive ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </Button>
  );

  const panel = (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <div
        className="grid grid-cols-2 gap-1 sm:flex sm:w-36 sm:shrink-0 sm:flex-col sm:border-r sm:border-border sm:pr-3"
        role="group"
        aria-label="Quick picks"
      >
        {HIRING_BATCH_QUICK_PICKS.map((pick) => {
          const active = resolved.batch === pick.value;
          return (
            <button
              key={pick.value}
              type="button"
              onClick={() => applyQuickPick(pick.value)}
              className={cn(
                "rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                active
                  ? "bg-primary text-primary-foreground shadow-subtle"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {pick.label}
            </button>
          );
        })}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <Calendar
          month={month}
          onMonthChange={setMonth}
          selected={draft}
          onSelect={setDraft}
          maxDate={istToday()}
        />
        <p className="text-[0.7rem] text-muted-foreground" aria-live="polite">
          {draft.from && draft.to && draft.from !== draft.to
            ? `Applied ${formatDateRangeLabel(draft.from, draft.to)}`
            : draft.from
              ? `From ${formatDateRangeLabel(draft.from, draft.from)} — pick an end date`
              : "Pick a start date, then an end date"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!draft.from} onClick={applyCustom}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );

  const clearButton = isActive ? (
    <button
      type="button"
      onClick={() => {
        close();
        onChange({ batch: "all" });
      }}
      className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      title="Clear applied date"
      aria-label="Clear applied date"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  ) : null;

  return (
    <div className="relative w-full">
      <div className="hidden sm:block">
        <Popover
          open={open}
          onOpenChange={(next) => (next ? openPanel() : close())}
          trigger={trigger}
          align="end"
          className="w-full"
          contentClassName="w-[min(100vw-2rem,30rem)]"
        >
          {panel}
        </Popover>
      </div>
      <div className="sm:hidden">
        {trigger}
        <Sheet
          open={mobileOpen}
          onClose={close}
          title="Applied date"
          description="Pick a quick range or choose dates on the calendar."
        >
          {panel}
        </Sheet>
      </div>
      {clearButton}
    </div>
  );
}
