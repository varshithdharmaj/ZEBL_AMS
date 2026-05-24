import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { accentStyles, type AccentColor } from "@/lib/accent-colors";
import type { LucideIcon } from "lucide-react";

export function DashboardCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
  className,
  children,
}: {
  label: string;
  value?: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: AccentColor;
  className?: string;
  children?: ReactNode;
}) {
  const colors = accentStyles[accent];

  return (
    <article
      className={cn(
        "flex h-full min-h-[8.25rem] flex-col rounded-2xl border border-border border-l-[3px] bg-card p-5 shadow-subtle transition-shadow hover:shadow-elevated",
        colors.border,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-medium leading-snug text-muted-foreground">{label}</p>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              colors.icon
            )}
          >
            <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="mt-auto pt-4">
        {children ?? (
          <>
            <p
              className={cn(
                "text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums",
                colors.value
              )}
            >
              {value}
            </p>
            {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
          </>
        )}
      </div>
    </article>
  );
}
