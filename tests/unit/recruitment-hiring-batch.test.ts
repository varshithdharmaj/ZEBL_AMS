import { describe, expect, it } from "vitest";
import {
  istToday,
  quickPickRange,
  resolveHiringBatch,
} from "@/lib/recruitment/shared/hiring-batch";

// 29 Sep 2026 20:00 UTC is already 30 Sep 2026 01:30 in IST.
const NOW = new Date("2026-09-29T20:00:00.000Z");

describe("quickPickRange", () => {
  it("uses the IST calendar day as today", () => {
    expect(istToday(NOW)).toBe("2026-09-30");
  });

  it("resolves every quick pick to inclusive day bounds", () => {
    expect(quickPickRange("all", NOW)).toBeNull();
    expect(quickPickRange("today", NOW)).toEqual({ from: "2026-09-30", to: "2026-09-30" });
    expect(quickPickRange("7d", NOW)).toEqual({ from: "2026-09-24", to: "2026-09-30" });
    expect(quickPickRange("this-month", NOW)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(quickPickRange("last-month", NOW)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(quickPickRange("3m", NOW)).toEqual({ from: "2026-06-30", to: "2026-09-30" });
    expect(quickPickRange("this-year", NOW)).toEqual({ from: "2026-01-01", to: "2026-09-30" });
  });

  it("handles year and month-length edges", () => {
    const jan15 = new Date("2026-01-15T06:00:00.000Z");
    expect(quickPickRange("last-month", jan15)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    const may31 = new Date("2026-05-31T06:00:00.000Z");
    expect(quickPickRange("3m", may31)?.from).toBe("2026-02-28");
  });
});

describe("resolveHiringBatch", () => {
  it("resolves quick picks and ignores stray dates on them", () => {
    expect(resolveHiringBatch({ batch: "last-month", appliedFrom: "2020-01-01" }, NOW)).toEqual({
      batch: "last-month",
      appliedFrom: "2026-08-01",
      appliedTo: "2026-08-31",
    });
    expect(resolveHiringBatch({ batch: "all", appliedFrom: "2026-01-01" }, NOW)).toEqual({
      batch: "all",
    });
  });

  it("keeps calendar-picked custom ranges", () => {
    expect(
      resolveHiringBatch({ batch: "custom", appliedFrom: "2026-01-01", appliedTo: "2026-01-31" }, NOW)
    ).toEqual({ batch: "custom", appliedFrom: "2026-01-01", appliedTo: "2026-01-31" });
    expect(resolveHiringBatch({ batch: "custom" }, NOW)).toEqual({ batch: "all" });
  });

  it("treats legacy date-only links as custom and bad input as all time", () => {
    expect(resolveHiringBatch({ appliedFrom: "2026-09-01" }, NOW)).toEqual({
      batch: "custom",
      appliedFrom: "2026-09-01",
      appliedTo: undefined,
    });
    expect(resolveHiringBatch({ batch: "forever", appliedFrom: "2026-09-01" }, NOW)).toEqual({
      batch: "all",
    });
  });
});
