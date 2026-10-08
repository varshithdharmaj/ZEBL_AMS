import { BATCH_BUCKETS, type BatchBucket, type BatchProgress } from "@/lib/recruitment/batch/batch-progress";
import { cn } from "@/lib/utils";

/** Stage counts. With onSelect, each count filters the sheet. */
export function BatchProgressLegend({
  progress,
  active,
  onSelect,
}: {
  progress: BatchProgress;
  active?: BatchBucket | null;
  onSelect?: (bucket: BatchBucket | null) => void;
}) {
  const shown = BATCH_BUCKETS.filter((b) => progress[b.id] > 0);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((b) => {
        const content = (
          <>
            {b.label}
            <span className="font-semibold tabular-nums text-foreground">{progress[b.id]}</span>
          </>
        );
        if (!onSelect) {
          return (
            <span key={b.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {content}
            </span>
          );
        }
        const isActive = active === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(isActive ? null : b.id)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "border-foreground/30 bg-muted text-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
