/**
 * Groups each candidate's application stage into the few buckets a batch's
 * stage counts show. Pure — safe for client imports.
 */

export type BatchBucket = "new" | "hr_round" | "manager_round" | "hire" | "on_hold" | "rejected";

export const BATCH_BUCKETS: ReadonlyArray<{ id: BatchBucket; label: string }> = [
  { id: "new", label: "New" },
  { id: "hr_round", label: "HR Round" },
  { id: "manager_round", label: "Manager Round" },
  { id: "hire", label: "Hire" },
  { id: "on_hold", label: "On Hold" },
  { id: "rejected", label: "Rejected" },
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
