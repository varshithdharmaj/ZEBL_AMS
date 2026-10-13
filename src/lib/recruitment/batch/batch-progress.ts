/**
 * Groups each candidate into the paper-plan buckets:
 * HR Round, Manager Round, Hire, Reject, Hold.
 */

export type BatchBucket = "hr_round" | "manager_round" | "hire" | "on_hold" | "rejected";

export const BATCH_BUCKETS: ReadonlyArray<{ id: BatchBucket; label: string }> = [
  { id: "hr_round", label: "HR Round" },
  { id: "manager_round", label: "Manager Round" },
  { id: "hire", label: "Hire" },
  { id: "rejected", label: "Reject" },
  { id: "on_hold", label: "Hold" },
];

const STAGE_BUCKET: Record<string, BatchBucket> = {
  resume_received: "hr_round",
  screening: "hr_round",
  assessment: "hr_round",
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

/** Closed applications (rejected / withdrawn / hold) win over the stage they stopped at. */
export function batchBucket(stage: string, status: string): BatchBucket {
  if (status === "hired") return "hire";
  if (status === "rejected" || status === "withdrawn") return "rejected";
  if (status === "on_hold") return "on_hold";
  return STAGE_BUCKET[stage] ?? (stage.startsWith("custom_") ? "manager_round" : "hr_round");
}

export type BatchProgress = Record<BatchBucket, number>;

export function emptyProgress(): BatchProgress {
  return { hr_round: 0, manager_round: 0, hire: 0, on_hold: 0, rejected: 0 };
}

export function countProgress(items: ReadonlyArray<{ stage: string; status: string }>): BatchProgress {
  const progress = emptyProgress();
  for (const item of items) progress[batchBucket(item.stage, item.status)] += 1;
  return progress;
}

/** Hire, Reject and Hold. HR Round and Manager Round are still open. */
export function decidedCount(progress: BatchProgress): number {
  return progress.hire + progress.rejected + progress.on_hold;
}

export type BatchWaitKind = "you" | "manager" | "close";

/**
 * One status for the HR dashboard's Waiting on column.
 * A named manager and a day count need batch sharing, which is not built yet.
 */
export function batchWait(progress: BatchProgress): { kind: BatchWaitKind; label: string } | null {
  if (progress.hr_round > 0) return { kind: "you", label: "You: HR round" };
  if (progress.manager_round > 0) return { kind: "manager", label: "Manager round" };
  if (decidedCount(progress) > 0) return { kind: "close", label: "Ready to close" };
  return null;
}
