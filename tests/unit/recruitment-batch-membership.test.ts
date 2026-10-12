import { describe, expect, it } from "vitest";
import {
  formatCtc,
  formatInterviewDate,
  parseInterviewDate,
  planBatchAdds,
  type BatchCandidate,
} from "@/lib/recruitment/batch/batch-membership";

const candidate = (over: Partial<BatchCandidate> & { applicationId: string }): BatchCandidate => ({
  name: over.applicationId,
  status: "active",
  batches: [],
  ...over,
});

describe("planBatchAdds", () => {
  it("adds candidates who are in no open batch, once each", () => {
    const plan = planBatchAdds("b1", [
      candidate({ applicationId: "a1" }),
      candidate({ applicationId: "a1" }),
      candidate({ applicationId: "a2", batches: [{ batchId: "old", code: "B-2026-001", open: false }] }),
    ]);
    expect(plan.add).toEqual(["a1", "a2"]);
    expect(plan.skipped).toEqual([]);
  });

  it("skips people already here, in another open batch, or withdrawn", () => {
    const plan = planBatchAdds("b1", [
      candidate({ applicationId: "a1", name: "Asha", batches: [{ batchId: "b1", code: "B-2026-002", open: true }] }),
      candidate({ applicationId: "a2", name: "Ravi", batches: [{ batchId: "b9", code: "B-2026-009", open: true }] }),
      candidate({ applicationId: "a3", name: "Meena", status: "withdrawn" }),
    ]);
    expect(plan.add).toEqual([]);
    expect(plan.skipped).toEqual([
      { name: "Asha", reason: "Already in this batch." },
      { name: "Ravi", reason: "Already in open batch B-2026-009." },
      { name: "Meena", reason: "Application was withdrawn." },
    ]);
  });
});

describe("interview date", () => {
  it("parses a date input to UTC midnight and rejects impossible dates", () => {
    expect(parseInterviewDate("2026-05-10")?.toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(parseInterviewDate("2026-02-30")).toBeNull();
    expect(parseInterviewDate("10/05/2026")).toBeNull();
  });

  it("formats without shifting the day", () => {
    expect(formatInterviewDate(new Date("2026-05-10T00:00:00.000Z"))).toBe("10 May 2026");
    expect(formatInterviewDate(null)).toBeNull();
  });
});

describe("formatCtc", () => {
  it("uses lakhs and crores", () => {
    expect(formatCtc(450000)).toBe("4.5 L");
    expect(formatCtc(12500000)).toBe("1.25 Cr");
    expect(formatCtc(85000)).toBe("85,000");
    expect(formatCtc(null)).toBeNull();
  });
});
