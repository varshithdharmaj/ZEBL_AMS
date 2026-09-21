import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionCard({
  id,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  noPadding,
  isEmpty,
  emptyIcon: EmptyIcon,
  emptyMessage,
}: {
  id?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
  /** When true, renders a compact empty state instead of `children`. */
  isEmpty?: boolean;
  emptyIcon?: LucideIcon;
  emptyMessage?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-subtle",
        className
      )}
    >
      {(title || action) && (
        <header className="flex flex-col gap-2 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {isEmpty ? (
        <div className="flex items-center gap-3 px-6 py-5 text-sm text-muted-foreground">
          {EmptyIcon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
              <EmptyIcon className="h-4 w-4" strokeWidth={1.75} />
            </span>
          )}
          <span>{emptyMessage}</span>
        </div>
      ) : (
        <div className={cn(!noPadding && "p-6", contentClassName)}>{children}</div>
      )}
    </section>
  );
}
