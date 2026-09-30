import { describe, expect, it } from "vitest";
import {
  describeHiringBatch,
  istToday,
  resolveHiringBatch,
} from "@/lib/recruitment/shared/hiring-batch";

// 29 Sep 2026 20:00 UTC is already 30 Sep 2026 01:30 in IST.
const NOW = new Date("2026-09-29T20:00:00.000Z");

describe("resolveHiringBatch", () => {
  it("uses the IST calendar day as today", () => {
    expect(istToday(NOW)).toBe("2026-09-30");
  });

  it("resolves rolling presets that end today", () => {
    expect(resolveHiringBatch({ batch: "today" }, NOW)).toEqual({
      batch: "today",
      appliedFrom: "2026-09-30",
    });
    expect(resolveHiringBatch({ batch: "7d" }, NOW).appliedFrom).toBe("2026-09-24");
    expect(resolveHiringBatch({ batch: "30d" }, NOW).appliedFrom).toBe("2026-09-01");
    expect(resolveHiringBatch({ batch: "3m" }, NOW).appliedFrom).toBe("2026-06-30");
    expect(resolveHiringBatch({ batch: "12m" }, NOW).appliedFrom).toBe("2025-09-30");
  });

  it("clamps month presets to the end of shorter months", () => {
    const may31 = new Date("2026-05-31T06:00:00.000Z");
    expect(resolveHiringBatch({ batch: "3m" }, may31).appliedFrom).toBe("2026-02-28");
  });

  it("ignores stray dates on presets and keeps them for custom", () => {
    expect(resolveHiringBatch({ batch: "all", appliedFrom: "2026-01-01" }, NOW)).toEqual({
      batch: "all",
    });
    expect(
      resolveHiringBatch({ batch: "custom", appliedFrom: "2026-01-01", appliedTo: "2026-01-31" }, NOW)
    ).toEqual({ batch: "custom", appliedFrom: "2026-01-01", appliedTo: "2026-01-31" });
  });

  it("treats legacy date-only links as custom and bad input as all time", () => {
    expect(resolveHiringBatch({ appliedFrom: "2026-09-01" }, NOW)).toEqual({
      batch: "custom",
      appliedFrom: "2026-09-01",
      appliedTo: undefined,
    });
    expect(resolveHiringBatch({ batch: "forever", appliedFrom: "bad" }, NOW)).toEqual({
      batch: "all",
    });
  });
});

describe("describeHiringBatch", () => {
  it("summarises the resolved window", () => {
    expect(describeHiringBatch({ batch: "all" }, NOW)).toBeNull();
    expect(describeHiringBatch(resolveHiringBatch({ batch: "today" }, NOW), NOW)).toBe(
      "Applied today"
    );
    expect(describeHiringBatch(resolveHiringBatch({ batch: "7d" }, NOW), NOW)).toBe(
      "Applied 24 Sept 2026 – today"
    );
  });
});
