/**
 * Groups each candidate's application stage into the few buckets a batch's
 * progress bar shows. Pure — safe for client imports.
 */

export type BatchBucket =
  | "new"
  | "hr_round"
  | "manager_round"
  | "other_round"
  | "selected"
  | "offer"
  | "joined"
  | "on_hold"
  | "rejected";

export const BATCH_BUCKETS: ReadonlyArray<{ id: BatchBucket; label: string; barClass: string; dotClass: string }> = [
  { id: "new", label: "New", barClass: "bg-slate-300 dark:bg-slate-600", dotClass: "bg-slate-400" },
  { id: "hr_round", label: "HR Round", barClass: "bg-sky-500", dotClass: "bg-sky-500" },
  { id: "manager_round", label: "Manager Round", barClass: "bg-indigo-500", dotClass: "bg-indigo-500" },
  { id: "other_round", label: "Other rounds", barClass: "bg-violet-400", dotClass: "bg-violet-400" },
  { id: "selected", label: "Selected", barClass: "bg-emerald-400", dotClass: "bg-emerald-400" },
  { id: "offer", label: "Offer", barClass: "bg-teal-500", dotClass: "bg-teal-500" },
  { id: "joined", label: "Joined", barClass: "bg-emerald-700", dotClass: "bg-emerald-700" },
  { id: "on_hold", label: "On Hold", barClass: "bg-amber-400", dotClass: "bg-amber-400" },
  { id: "rejected", label: "Rejected", barClass: "bg-rose-400", dotClass: "bg-rose-400" },
];

const STAGE_BUCKET: Record<string, BatchBucket> = {
  resume_received: "new",
  screening: "new",
  assessment: "new",
  hr_round: "hr_round",
  manager_round: "manager_round",
  technical_round: "other_round",
  team_lead_round: "other_round",
  client_round: "other_round",
  reference_check: "other_round",
  decision: "selected",
  offer: "offer",
  hired: "joined",
  rejected: "rejected",
  withdrawn: "rejected",
  on_hold: "on_hold",
};

/** Closed applications (rejected / withdrawn / on hold) win over the stage they stopped at. */
export function batchBucket(stage: string, status: string): BatchBucket {
  if (status === "hired") return "joined";
  if (status === "rejected" || status === "withdrawn") return "rejected";
  if (status === "on_hold") return "on_hold";
  return STAGE_BUCKET[stage] ?? (stage.startsWith("custom_") ? "other_round" : "new");
}

export type BatchProgress = Record<BatchBucket, number>;

export function emptyProgress(): BatchProgress {
  return {
    new: 0,
    hr_round: 0,
    manager_round: 0,
    other_round: 0,
    selected: 0,
    offer: 0,
    joined: 0,
    on_hold: 0,
    rejected: 0,
  };
}

export function countProgress(items: ReadonlyArray<{ stage: string; status: string }>): BatchProgress {
  const progress = emptyProgress();
  for (const item of items) progress[batchBucket(item.stage, item.status)] += 1;
  return progress;
}
