import { cn } from "@/lib/utils";
import { accentStyles, type AccentColor } from "@/lib/accent-colors";

export function SectionCard({
  title,
  description,
  action,
  accent = "primary",
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  accent?: AccentColor;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const colors = accentStyles[accent];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-subtle",
        className
      )}
    >
      {(title || action) && (
        <div
          className={cn(
            "flex flex-col gap-1 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
            colors.header
          )}
        >
          <div className="border-l-[3px] border-l-primary pl-3">
            {title && (
              <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-6", contentClassName)}>{children}</div>
    </section>
  );
}
