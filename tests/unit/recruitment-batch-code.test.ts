import { describe, expect, it } from "vitest";
import { batchCodeBase, nextBatchCode } from "@/lib/recruitment/batch/batch-code";

const oct15 = new Date(Date.UTC(2026, 9, 15));

describe("batch IDs from the interview date", () => {
  it("reads like the paper plan: DB month/day/year", () => {
    expect(batchCodeBase(oct15)).toBe("DB 10/15/26");
    expect(batchCodeBase(new Date(Date.UTC(2027, 0, 3)))).toBe("DB 1/3/27");
  });

  it("numbers a second and third batch on the same day", () => {
    expect(nextBatchCode([], oct15)).toBe("DB 10/15/26");
    expect(nextBatchCode(["DB 10/15/26"], oct15)).toBe("DB 10/15/26-2");
    expect(nextBatchCode(["DB 10/15/26", "DB 10/15/26-2"], oct15)).toBe("DB 10/15/26-3");
  });

  it("ignores other days that share the same start", () => {
    // "DB 10/1/26" is the start of "DB 10/15/26" as text, but a different day.
    expect(nextBatchCode(["DB 10/15/26"], new Date(Date.UTC(2026, 9, 1)))).toBe("DB 10/1/26");
    expect(nextBatchCode(["DB 10/1/26"], oct15)).toBe("DB 10/15/26");
  });
});
