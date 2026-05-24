"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardToolbar({
  defaultDate,
  defaultMonth,
  layout = "default",
}: {
  defaultDate: string;
  defaultMonth: string;
  layout?: "default" | "compact" | "inline";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? defaultDate;
  const month = searchParams.get("month") ?? defaultMonth;

  function push(updates: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    router.push(`${pathname}?${p.toString()}`);
  }

  const months = getRecentMonths(6);

  if (layout === "compact") {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterField label="View day">
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => push({ date: e.target.value })}
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => push({ date: null })}
                className="shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Today
              </button>
            </div>
          </FilterField>
          <FilterField label="View month">
            <input
              type="month"
              value={month}
              onChange={(e) => push({ month: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </FilterField>
        </div>
        <MonthChips months={months} active={month} onSelect={(v) => push({ month: v })} />
      </div>
    );
  }

  if (layout === "inline") {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => push({ month: e.target.value })}
          aria-label="Filter by month"
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <MonthChips months={months.slice(0, 4)} active={month} onSelect={(v) => push({ month: v })} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterField label="Day">
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => push({ date: e.target.value })}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <button
            type="button"
            onClick={() => push({ date: null })}
            className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Today
          </button>
        </div>
      </FilterField>
      <FilterField label="Month">
        <input
          type="month"
          value={month}
          onChange={(e) => push({ month: e.target.value })}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </FilterField>
      <MonthChips months={months} active={month} onSelect={(v) => push({ month: v })} />
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function MonthChips({
  months,
  active,
  onSelect,
}: {
  months: { value: string; label: string }[];
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick month selection">
      {months.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onSelect(m.value)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            active === m.value
              ? "bg-primary text-primary-foreground shadow-subtle"
              : "bg-muted text-muted-foreground hover:bg-primary-muted/60 hover:text-primary"
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function getRecentMonths(n: number) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "short", year: i > 0 ? "2-digit" : undefined }),
    });
  }
  return out;
}
