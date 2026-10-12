/**
 * Batch IDs follow HR's paper plan: "DB 10/15/26" for a batch interviewed on
 * 15 Oct 2026, and "DB 10/15/26-2" for a second batch that day. Interview
 * dates are stored as calendar days (midnight UTC), so the day is read in UTC.
 */

export function batchCodeBase(interviewDate: Date): string {
  const month = interviewDate.getUTCMonth() + 1;
  const day = interviewDate.getUTCDate();
  const year = String(interviewDate.getUTCFullYear()).slice(-2);
  return `DB ${month}/${day}/${year}`;
}

/** Matches every ID for that day ("DB 10/15/26" and "DB 10/15/26-N"), for the lookup query. */
export function batchCodePrefix(interviewDate: Date): string {
  return batchCodeBase(interviewDate);
}

/** The next free ID for that interview date. */
export function nextBatchCode(existingCodes: readonly string[], interviewDate: Date): string {
  const base = batchCodeBase(interviewDate);
  let max = 0;
  for (const code of existingCodes) {
    if (code === base) max = Math.max(max, 1);
    else if (code.startsWith(`${base}-`)) {
      const n = Number.parseInt(code.slice(base.length + 1), 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return max === 0 ? base : `${base}-${max + 1}`;
}
