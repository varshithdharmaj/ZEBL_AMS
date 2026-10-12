/**
 * Batch IDs come from the interview date: B-15Oct26-1, and B-15Oct26-2 for a
 * second batch on the same day. Interview dates are stored as calendar days
 * (midnight UTC), so the day is read in UTC.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function batchCodePrefix(interviewDate: Date): string {
  const day = String(interviewDate.getUTCDate()).padStart(2, "0");
  const month = MONTHS[interviewDate.getUTCMonth()];
  const year = String(interviewDate.getUTCFullYear()).slice(-2);
  return `B-${day}${month}${year}-`;
}

/** The next code for that interview date, after the highest one already used. */
export function nextBatchCode(existingCodes: readonly string[], interviewDate: Date): string {
  const prefix = batchCodePrefix(interviewDate);
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number.parseInt(code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}
