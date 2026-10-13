import { describe, expect, it } from "vitest";
import { batchWait, decidedCount, emptyProgress } from "@/lib/recruitment/batch/batch-progress";

describe("batch dashboard progress", () => {
  it("counts Hire, Reject and Hold as decided", () => {
    const progress = { ...emptyProgress(), hr_round: 4, manager_round: 2, hire: 3, rejected: 2, on_hold: 1 };
    expect(decidedCount(progress)).toBe(6);
  });

  it("says who the batch is waiting on", () => {
    expect(batchWait({ ...emptyProgress(), hr_round: 2 })).toEqual({ kind: "you", label: "You: HR round" });
    expect(batchWait({ ...emptyProgress(), hr_round: 1, manager_round: 4 })).toEqual({
      kind: "you",
      label: "You: HR round",
    });
    expect(batchWait({ ...emptyProgress(), manager_round: 6, hire: 3, rejected: 3 })).toEqual({
      kind: "manager",
      label: "Manager round",
    });
    expect(batchWait({ ...emptyProgress(), hire: 4, on_hold: 1, rejected: 3 })).toEqual({
      kind: "close",
      label: "Ready to close",
    });
    expect(batchWait(emptyProgress())).toBeNull();
  });
});
