import { cn } from "@/lib/utils";
import { LEAVE_TYPE_LABELS, formatLeaveDays, type LeaveType } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";

const cardStyles: Record<
  LeaveType,
  { border: string; badge: string; value: string; header: string }
> = {
  EL: {
    border: "border-l-emerald",
    badge: "bg-emerald-muted text-emerald",
    value: "text-emerald",
    header: "bg-emerald-muted/40",
  },
  CL: {
    border: "border-l-sky",
    badge: "bg-sky-muted text-sky",
    value: "text-sky",
    header: "bg-sky-muted/40",
  },
  SL: {
    border: "border-l-amber",
    badge: "bg-amber-muted text-amber",
    value: "text-amber",
    header: "bg-amber-muted/40",
  },
};

export function LeaveBalanceGrid({ balances }: { balances: LeaveBalanceSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {balances.map((item) => {
        const type = item.leaveType as LeaveType;
        const style = cardStyles[type];
        return (
          <div
            key={item.leaveType}
            className={cn(
              "overflow-hidden rounded-2xl border border-border border-l-[3px] bg-card shadow-subtle",
              style.border
            )}
          >
            <div className={cn("flex items-center justify-between gap-2 px-5 py-3", style.header)}>
              <p className="text-xs font-semibold text-foreground">{LEAVE_TYPE_LABELS[type]}</p>
              <span className={cn("rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold", style.badge)}>
                {item.leaveType}
              </span>
            </div>
            <div className="p-5 pt-4">
              <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", style.value)}>
                {formatLeaveDays(item.remaining)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatLeaveDays(item.used)}</span> used ·{" "}
                <span className="tabular-nums">{formatLeaveDays(item.total)}</span> total
              </p>
              {item.note && (
                <p className="mt-3 rounded-md bg-warning-muted px-2 py-1 text-xs text-warning">
                  {item.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
