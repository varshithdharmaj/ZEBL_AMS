import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLeaveDays, LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";
import { minutesToHours } from "@/lib/utils";

const leaveColors: Record<string, string> = {
  EL: "text-emerald",
  CL: "text-sky",
  SL: "text-amber",
};

const statTints = [
  "bg-emerald-muted/80 border-emerald/15",
  "bg-amber-muted/80 border-amber/15",
  "bg-violet-muted/80 border-violet/15",
  "bg-teal-muted/80 border-teal/15",
];

export function MonthlySummaryPanel({
  monthLabel,
  attendancePercent,
  presentDays,
  shortHoursCount,
  overtimeMinutes,
  balances,
}: {
  monthLabel: string;
  attendancePercent: number;
  presentDays: number;
  shortHoursCount: number;
  overtimeMinutes: number;
  balances: LeaveBalanceSummary[];
}) {
  const totalLeaveRemaining = balances.reduce((sum, b) => sum + b.remaining, 0);

  const stats = [
    { label: "Present days", value: presentDays, valueClass: "text-emerald" },
    { label: "Short hours", value: shortHoursCount, valueClass: "text-amber" },
    { label: "Overtime", value: minutesToHours(overtimeMinutes), valueClass: "text-violet" },
    { label: "Leave left", value: formatLeaveDays(totalLeaveRemaining), valueClass: "text-teal" },
  ];

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-violet/15 bg-card shadow-subtle">
      <header className="border-b border-border bg-violet-muted/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-muted text-violet ring-1 ring-violet/20">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-violet">Monthly summary</h2>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <div className="mb-2 flex items-end justify-between gap-2">
            <span className="text-sm text-muted-foreground">Attendance rate</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-primary">
              {attendancePercent}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-violet transition-all duration-500"
              style={{ width: `${Math.min(attendancePercent, 100)}%` }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`rounded-xl border px-4 py-3 ${statTints[i]}`}
            >
              <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${stat.valueClass}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto space-y-3 border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-teal">Leave snapshot</p>
          <ul className="space-y-2">
            {balances.map((b) => (
              <li key={b.leaveType} className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">
                  {LEAVE_TYPE_LABELS[b.leaveType as LeaveType]}
                </span>
                <span className={`font-semibold tabular-nums ${leaveColors[b.leaveType] ?? "text-foreground"}`}>
                  {formatLeaveDays(b.remaining)}{" "}
                  <span className="font-normal text-muted-foreground">left</span>
                </span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/employee/leaves">
              Manage leave
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
