import { Suspense } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardToolbar } from "@/components/employee/dashboard-toolbar";
import { minutesToHours } from "@/lib/utils";

export function DashboardHero({
  firstName,
  fullName,
  displayDate,
  dateIso,
  status,
  workedMinutes,
  presentDays,
  monthLabel,
  defaultDate,
  defaultMonth,
}: {
  firstName: string;
  fullName: string | null;
  displayDate: string;
  dateIso: string;
  status: string;
  workedMinutes: number;
  presentDays: number;
  monthLabel: string;
  defaultDate: string;
  defaultMonth: string;
}) {
  return (
    <section className="employee-dashboard__hero overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-muted via-card to-sky-muted/30 shadow-elevated">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-8 lg:p-8">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <time dateTime={dateIso} className="font-medium text-primary">
              {displayDate}
            </time>
            {fullName && (
              <>
                <span className="text-border" aria-hidden>
                  ·
                </span>
                <span className="truncate text-muted-foreground">{fullName}</span>
              </>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-violet">Good day,</p>
            <h1 className="bg-gradient-to-r from-primary to-violet bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-[2rem] sm:leading-tight">
              {firstName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} />
            <span className="h-4 w-px bg-primary/20" aria-hidden />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-sky">{minutesToHours(workedMinutes)}</span>{" "}
              worked ·{" "}
              <span className="font-semibold tabular-nums text-emerald">{presentDays}</span> present
              in <span className="font-medium text-foreground">{monthLabel}</span>
            </p>
          </div>
        </div>

        <div className="w-full shrink-0 rounded-xl border border-primary/10 bg-card/80 p-4 backdrop-blur-sm lg:min-w-[22rem] lg:max-w-[28rem]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-primary">
            Filters
          </p>
          <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-primary-muted" />}>
            <DashboardToolbar defaultDate={defaultDate} defaultMonth={defaultMonth} layout="compact" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
