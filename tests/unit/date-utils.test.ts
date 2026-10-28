import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  toISODate,
  toUtcDateInputValue,
  formatDate,
  parseISODate,
  startOfDay,
  defaultDateRange,
  parseDateRange,
} from "@/lib/utils";

describe("toUtcDateInputValue", () => {
  it("uses UTC calendar day for UTC-midnight joining/DOB values", () => {
    const stored = new Date("2026-09-06T00:00:00.000Z");
    expect(toUtcDateInputValue(stored)).toBe("2026-09-06");
    expect(formatDate(stored)).toMatch(/Sept/);
    expect(formatDate(stored)).not.toMatch(/Jun/);
  });

  it("accepts ISO strings the same way as Date instances", () => {
    expect(toUtcDateInputValue("2026-09-06T00:00:00.000Z")).toBe("2026-09-06");
  });

  it("documents IST local-midnight vs UTC-midnight for calendar fields", () => {
    const utcMidnight = new Date("2026-09-06T00:00:00.000Z");
    expect(toUtcDateInputValue(utcMidnight)).toBe("2026-09-06");
    expect(formatDate(utcMidnight)).toContain("06 Sept 2026");

    const istLocalMidnight = new Date("2026-09-05T18:30:00.000Z");
    expect(toUtcDateInputValue(istLocalMidnight)).toBe("2026-09-05");
    expect(formatDate(istLocalMidnight)).toMatch(/Sept/);
  });

  it("returns empty string for invalid dates", () => {
    expect(toUtcDateInputValue(new Date("not-a-date"))).toBe("");
  });
});

describe("toISODate", () => {
  it("returns the local calendar date, not the UTC-shifted one", () => {
    // Regression: the previous implementation used `.toISOString().split("T")[0]`,
    // which rolls back a day for any positive-UTC-offset timezone (e.g. IST) because
    // local midnight is still the previous calendar day in UTC.
    expect(toISODate(new Date(2026, 6, 22))).toBe("2026-07-22");
  });

  it("ignores time-of-day once zeroed by startOfDay", () => {
    const withTime = new Date(2026, 6, 22, 23, 45, 0);
    expect(toISODate(startOfDay(withTime))).toBe("2026-07-22");
  });

  it("handles a year boundary", () => {
    expect(toISODate(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  it("round-trips through parseISODate", () => {
    const original = startOfDay(new Date(2026, 3, 5));
    const roundTripped = parseISODate(toISODate(original));
    expect(roundTripped?.getTime()).toBe(original.getTime());
  });
});

describe("defaultDateRange / parseDateRange with a fixed clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves the default range to the active 25th-to-25th cycle through today", () => {
    // Before the 25th, the cycle started on the *previous* month's 25th; today's
    // date must still reflect the LOCAL calendar day the clock is set to.
    expect(defaultDateRange()).toEqual({ start: "2026-06-25", end: "2026-07-22" });
  });

  it("swaps an inverted range and still reports the corrected ISO bounds", () => {
    const { startIso, endIso } = parseDateRange("2026-07-20", "2026-07-05");
    expect(startIso).toBe("2026-07-05");
    expect(endIso).toBe("2026-07-20");
  });

  it("treats a same-day range as a single day", () => {
    const { startIso, endIso } = parseDateRange("2026-07-10", "2026-07-10");
    expect(startIso).toBe("2026-07-10");
    expect(endIso).toBe("2026-07-10");
  });
});
