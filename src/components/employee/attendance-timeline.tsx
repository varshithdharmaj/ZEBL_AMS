import { LogIn, LogOut, Clock, Timer } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { minutesToHours } from "@/lib/utils";

const stepColors = [
  { active: "border-sky/30 bg-sky-muted text-sky", line: "bg-sky/40" },
  { active: "border-violet/30 bg-violet-muted text-violet", line: "bg-violet/40" },
  { active: "border-emerald/30 bg-emerald-muted text-emerald", line: "bg-emerald/40" },
  { active: "border-amber/30 bg-amber-muted text-amber", line: "bg-amber/40" },
];

export function AttendanceTimeline({
  checkIn,
  checkOut,
  workedMinutes,
  overtimeMinutes,
  status,
  selectedDateLabel,
}: {
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
  selectedDateLabel?: string;
}) {
  const items = [
    { icon: LogIn, label: "Check in", value: checkIn ?? "—", active: Boolean(checkIn) },
    { icon: LogOut, label: "Check out", value: checkOut ?? "—", active: Boolean(checkOut) },
    { icon: Clock, label: "Worked", value: minutesToHours(workedMinutes), active: workedMinutes > 0 },
    { icon: Timer, label: "Overtime", value: minutesToHours(overtimeMinutes), active: overtimeMinutes > 0 },
  ];

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-sky/15 bg-card shadow-subtle">
      <header className="flex flex-col gap-3 border-b border-border bg-sky-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="border-l-[3px] border-sky pl-3">
          <h2 className="text-[0.9375rem] font-semibold text-sky">Attendance overview</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {selectedDateLabel ?? "Selected day"}
          </p>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="hidden flex-1 p-6 md:block">
        <div className="relative grid h-full grid-cols-4 gap-4">
          <div
            className="pointer-events-none absolute left-[12%] right-[12%] top-5 h-px bg-gradient-to-r from-sky/30 via-violet/30 to-amber/30"
            aria-hidden
          />
          {items.map((item, i) => {
            const Icon = item.icon;
            const color = stepColors[i];
            return (
              <div key={item.label} className="relative flex flex-col items-center text-center">
                <div
                  className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border shadow-subtle ${
                    item.active ? color.active : "border-transparent bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-4 text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-6 md:hidden">
        <div className="relative pl-1">
          <div className="absolute left-[19px] top-2 bottom-4 w-px bg-gradient-to-b from-sky/40 via-violet/40 to-amber/40" aria-hidden />
          <ul className="space-y-5">
            {items.map((item, i) => {
              const Icon = item.icon;
              const color = stepColors[i];
              return (
                <li key={item.label} className="relative flex gap-4">
                  <div
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      item.active ? color.active : "border-transparent bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                      {item.value}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}
