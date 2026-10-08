export type BatchCandidate = {
  applicationId: string;
  name: string;
  status: string;
  /** Batches this application is already in (deleted batches excluded). */
  batches: Array<{ batchId: string; code: string; open: boolean }>;
};

export type BatchAddPlan = {
  add: string[];
  skipped: Array<{ name: string; reason: string }>;
};

/** Which picked applications go into `batchId`; an application sits in at most one open batch. */
export function planBatchAdds(batchId: string, picked: readonly BatchCandidate[]): BatchAddPlan {
  const plan: BatchAddPlan = { add: [], skipped: [] };
  const seen = new Set<string>();
  for (const c of picked) {
    if (seen.has(c.applicationId)) continue;
    seen.add(c.applicationId);
    if (c.batches.some((b) => b.batchId === batchId)) {
      plan.skipped.push({ name: c.name, reason: "Already in this batch." });
      continue;
    }
    const otherOpen = c.batches.find((b) => b.open);
    if (otherOpen) {
      plan.skipped.push({ name: c.name, reason: `Already in open batch ${otherOpen.code}.` });
      continue;
    }
    if (c.status === "withdrawn") {
      plan.skipped.push({ name: c.name, reason: "Application was withdrawn." });
      continue;
    }
    plan.add.push(c.applicationId);
  }
  return plan;
}

/** "2026-05-10" (a date input) → Date at UTC midnight, matching a Postgres DATE column. */
export function parseInterviewDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCMonth() === Number(m[2]) - 1 ? date : null;
}

/** DATE columns come back as UTC midnight; format in UTC so the day never shifts. */
export function formatInterviewDate(date: Date | string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** 450000 → "4.5 L", 12500000 → "1.25 Cr" (Indian CTC shorthand). */
export function formatCtc(amount: number | null): string | null {
  if (amount == null) return null;
  if (amount >= 1_00_00_000) return `${trim(amount / 1_00_00_000)} Cr`;
  if (amount >= 1_00_000) return `${trim(amount / 1_00_000)} L`;
  return amount.toLocaleString("en-IN");
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}
