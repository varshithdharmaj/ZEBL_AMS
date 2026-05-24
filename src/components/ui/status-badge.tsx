import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  present: "border border-emerald/20 bg-emerald-muted text-emerald",
  absent: "border border-danger/20 bg-danger-muted text-danger",
  short: "border border-amber/20 bg-amber-muted text-amber",
  pending: "border border-amber/20 bg-amber-muted text-amber",
  approved: "border border-emerald/20 bg-emerald-muted text-emerald",
  rejected: "border border-danger/20 bg-danger-muted text-danger",
  default: "border border-border bg-muted text-muted-foreground",
  active: "border border-emerald/20 bg-emerald-muted text-emerald",
  inactive: "border border-border bg-muted text-muted-foreground",
  resigned: "border border-danger/20 bg-danger-muted text-danger",
};

function resolveVariant(status: string): string {
  const s = status.toLowerCase();
  if (s === "present" || s === "active") return "present";
  if (s === "absent" || s === "resigned") return "absent";
  if (s.includes("short")) return "short";
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "inactive") return "inactive";
  return "default";
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = resolveVariant(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[variant],
        className
      )}
    >
      {status}
    </span>
  );
}
