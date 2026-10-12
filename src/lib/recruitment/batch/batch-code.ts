/** Batch IDs read B-2026-001, B-2026-002, … and restart at 001 each year (IST). */

export function batchCodePrefix(year: number): string {
  return `B-${year}-`;
}

export function istYear(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(now)
  );
}

/** The next code after the highest one already used this year. */
export function nextBatchCode(existingCodes: readonly string[], year: number): string {
  const prefix = batchCodePrefix(year);
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number.parseInt(code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
