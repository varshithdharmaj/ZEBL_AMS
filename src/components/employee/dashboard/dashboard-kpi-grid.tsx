import {
  Clock,
  CalendarCheck,
  Timer,
  AlertCircle,
  Palmtree,
} from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { formatLeaveDays } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";
import { cn, minutesToHours } from "@/lib/utils";

export function DashboardKpiGrid({
  workedMinutes,
  presentDays,
  overtimeMinutes,
  shortHoursCount,
  monthLabel,
  balances,
}: {
  workedMinutes: number;
  presentDays: number;
  overtimeMinutes: number;
  shortHoursCount: number;
  monthLabel: string;
  balances: LeaveBalanceSummary[];
}) {
  const el = balances.find((b) => b.leaveType === "EL");
  const cl = balances.find((b) => b.leaveType === "CL");
  const sl = balances.find((b) => b.leaveType === "SL");

  const leaveRows = [
    { key: "EL", val: el?.remaining ?? 0, color: "text-emerald" as const },
    { key: "CL", val: cl?.remaining ?? 0, color: "text-sky" as const },
    { key: "SL", val: sl?.remaining ?? 0, color: "text-amber" as const },
  ];

  return (
    <section className="employee-dashboard__kpi employee-dashboard-kpi" aria-label="Key metrics">
      <DashboardCard
        label="Today hours worked"
        value={minutesToHours(workedMinutes)}
        hint="Selected day"
        icon={Clock}
        accent="sky"
      />
      <DashboardCard
        label="Present days"
        value={presentDays}
        hint={monthLabel}
        icon={CalendarCheck}
        accent="emerald"
      />
      <DashboardCard
        label="Overtime hours"
        value={minutesToHours(overtimeMinutes)}
        hint="This month"
        icon={Timer}
        accent="violet"
      />
      <DashboardCard
        label="Short hours"
        value={shortHoursCount}
        hint="This month"
        icon={AlertCircle}
        accent="amber"
      />
      <DashboardCard label="Leave balance" icon={Palmtree} accent="teal">
        <ul className="space-y-2">
          {leaveRows.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-muted-foreground">{row.key}</span>
              <span className={cn("text-lg font-semibold tabular-nums tracking-tight", row.color)}>
                {formatLeaveDays(row.val)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Remaining balance</p>
      </DashboardCard>
    </section>
  );
}
