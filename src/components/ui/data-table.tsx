import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  children,
  emptyMessage = "No records found.",
  className,
}: {
  columns: string[];
  children: React.ReactNode;
  emptyMessage?: string;
  className?: string;
}) {
  const isEmpty =
    !children || (Array.isArray(children) && children.length === 0);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-card shadow-subtle",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-primary/10 bg-primary-muted/40">
              {columns.map((col) => (
                <th
                  key={col}
                  className="sticky top-0 z-10 whitespace-nowrap bg-primary-muted/90 px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-primary backdrop-blur-sm lg:px-5 lg:py-3"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isEmpty ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-16 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataTableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("transition-colors hover:bg-primary-muted/25", className)}>{children}</tr>
  );
}

export function DataTableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3 text-[0.875rem] text-foreground/90 lg:px-5 lg:py-3", className)}>
      {children}
    </td>
  );
}
