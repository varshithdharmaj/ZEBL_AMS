/**
 * Groups each candidate's application stage into the few buckets a batch's
 * progress bar shows. Pure — safe for client imports.
 */

export type BatchBucket = "new" | "hr_round" | "manager_round" | "hire" | "on_hold" | "rejected";

/** Rounds share one blue; colour is kept for outcomes (hire, hold, reject). */
export const BATCH_BUCKETS: ReadonlyArray<{ id: BatchBucket; label: string; barClass: string; dotClass: string }> = [
  { id: "new", label: "New", barClass: "bg-slate-300 dark:bg-slate-600", dotClass: "bg-slate-400" },
  { id: "hr_round", label: "HR Round", barClass: "bg-sky-300 dark:bg-sky-700", dotClass: "bg-sky-300 dark:bg-sky-700" },
  { id: "manager_round", label: "Manager Round", barClass: "bg-sky-500", dotClass: "bg-sky-500" },
  { id: "hire", label: "Hire", barClass: "bg-emerald-500", dotClass: "bg-emerald-500" },
  { id: "on_hold", label: "On Hold", barClass: "bg-amber-400", dotClass: "bg-amber-400" },
  { id: "rejected", label: "Rejected", barClass: "bg-rose-400", dotClass: "bg-rose-400" },
];

const STAGE_BUCKET: Record<string, BatchBucket> = {
  resume_received: "new",
  screening: "new",
  assessment: "new",
  hr_round: "hr_round",
  manager_round: "manager_round",
  technical_round: "manager_round",
  team_lead_round: "manager_round",
  client_round: "manager_round",
  reference_check: "manager_round",
  decision: "hire",
  offer: "hire",
  hired: "hire",
  rejected: "rejected",
  withdrawn: "rejected",
  on_hold: "on_hold",
};

/** Closed applications (rejected / withdrawn / on hold) win over the stage they stopped at. */
export function batchBucket(stage: string, status: string): BatchBucket {
  if (status === "hired") return "hire";
  if (status === "rejected" || status === "withdrawn") return "rejected";
  if (status === "on_hold") return "on_hold";
  return STAGE_BUCKET[stage] ?? (stage.startsWith("custom_") ? "manager_round" : "new");
}

export type BatchProgress = Record<BatchBucket, number>;

export function emptyProgress(): BatchProgress {
  return { new: 0, hr_round: 0, manager_round: 0, hire: 0, on_hold: 0, rejected: 0 };
}

export function countProgress(items: ReadonlyArray<{ stage: string; status: string }>): BatchProgress {
  const progress = emptyProgress();
  for (const item of items) progress[batchBucket(item.stage, item.status)] += 1;
  return progress;
}
