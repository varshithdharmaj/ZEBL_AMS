import { cn, minutesToHours } from "@/lib/utils";
import { formatTimeAmPm } from "@/lib/attendance-shift";
import type { ActiveRegularizationDetail } from "@/lib/attendance/history-classification";

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  missing_check_in: "Missing check-in",
  missing_check_out: "Missing check-out",
  missing_both: "Missing both check-in and check-out",
  incorrect_check_in: "Incorrect check-in time",
  incorrect_check_out: "Incorrect check-out time",
  attendance_missing: "Attendance missing for the day",
  device_failure: "Biometric device failure",
};

type SnapshotBefore = {
  checkIn?: string | null;
  checkOut?: string | null;
  workedMinutes?: number;
};

function parseSnapshotBefore(value: unknown): SnapshotBefore | null {
  if (!value || typeof value !== "object") return null;
  return value as SnapshotBefore;
}

const BADGE_CLASS =
  "bg-purple-100 text-purple-800 ring-1 ring-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-400/20";

/**
 * The purple "Regularised" pill, with a hover/focus audit panel showing what HR
 * approved: the original biometric snapshot vs. the regularised values now live on
 * the record. Pure CSS group-hover/focus-within — no client-side state needed, so
 * this stays usable from server components (admin table, employee history table).
 */
export function RegularisedBadge({
  detail,
  currentCheckIn,
  currentCheckOut,
  currentWorkedMinutes,
}: {
  detail: ActiveRegularizationDetail | null | undefined;
  currentCheckIn: string | null;
  currentCheckOut: string | null;
  currentWorkedMinutes: number;
}) {
  const before = parseSnapshotBefore(detail?.snapshotBefore);

  return (
    <span className="group/audit relative inline-block">
      <span
        tabIndex={detail ? 0 : undefined}
        className={cn(
          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-tight outline-none",
          detail && "cursor-help focus-visible:ring-2 focus-visible:ring-purple-400",
          BADGE_CLASS
        )}
      >
        Regularised
      </span>

      {detail && (
        // Fixed dark card regardless of app theme (by design, not theme-token driven) —
        // guarantees an opaque, high-contrast surface so nothing behind it (table text,
        // the row below) can show or bleed through. z-50 keeps it above sticky table
        // headers and neighbouring row content.
        <div
          role="tooltip"
          className={cn(
            "invisible absolute right-0 top-full z-50 mt-1.5 w-80 max-w-[85vw] rounded-xl border border-zinc-800",
            "bg-zinc-900 p-4 text-xs text-zinc-200 opacity-0 shadow-2xl transition-opacity",
            "group-hover/audit:visible group-hover/audit:opacity-100",
            "group-focus-within/audit:visible group-focus-within/audit:opacity-100"
          )}
        >
          <p className="font-semibold text-zinc-50">
            {REQUEST_TYPE_LABELS[detail.requestType] ?? detail.requestType}
          </p>

          <p className="mt-1.5 leading-relaxed text-zinc-400">
            <span className="font-medium text-zinc-200">Reason: </span>
            {detail.reason}
          </p>

          {detail.reviewComment && (
            <p className="mt-1 leading-relaxed text-zinc-400">
              <span className="font-medium text-zinc-200">HR comment: </span>
              {detail.reviewComment}
            </p>
          )}

          {/* Stacked rows (not a 2-column grid) — each row's own flow height means a
              wrapped time string can never overlap the row below it. */}
          <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/60 px-2.5 py-1.5">
              <span className="shrink-0 font-medium text-zinc-300">Original</span>
              <span className="tabular-nums text-zinc-400">
                {formatTimeAmPm(before?.checkIn ?? null)} – {formatTimeAmPm(before?.checkOut ?? null)}
                {" · "}
                {minutesToHours(before?.workedMinutes ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-purple-500/10 px-2.5 py-1.5">
              <span className="shrink-0 font-medium text-purple-300">Regularised</span>
              <span className="tabular-nums text-purple-200">
                {formatTimeAmPm(currentCheckIn)} – {formatTimeAmPm(currentCheckOut)}
                {" · "}
                {minutesToHours(currentWorkedMinutes)}
              </span>
            </div>
          </div>

          {detail.reviewedAt && (
            <p className="mt-3 border-t border-zinc-800 pt-2 text-[0.6875rem] text-zinc-500">
              Reviewed {new Date(detail.reviewedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </span>
  );
}
