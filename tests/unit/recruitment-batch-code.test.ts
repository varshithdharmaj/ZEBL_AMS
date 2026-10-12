import { describe, expect, it } from "vitest";
import { batchCodePrefix, nextBatchCode } from "@/lib/recruitment/batch/batch-code";

const oct15 = new Date(Date.UTC(2026, 9, 15));

describe("batch IDs from the interview date", () => {
  it("reads the date as a calendar day", () => {
    expect(batchCodePrefix(oct15)).toBe("B-15Oct26-");
    expect(batchCodePrefix(new Date(Date.UTC(2027, 0, 3)))).toBe("B-03Jan27-");
  });

  it("numbers batches on the same day 1, 2, 3", () => {
    expect(nextBatchCode([], oct15)).toBe("B-15Oct26-1");
    expect(nextBatchCode(["B-15Oct26-1", "B-16Oct26-4"], oct15)).toBe("B-15Oct26-2");
    expect(nextBatchCode(["B-15Oct26-1", "B-15Oct26-9"], oct15)).toBe("B-15Oct26-10");
  });
});
