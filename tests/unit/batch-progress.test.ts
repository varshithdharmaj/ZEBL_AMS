import { describe, expect, it } from "vitest";
import { decidedCount, emptyProgress } from "@/lib/recruitment/batch/batch-progress";

describe("batch dashboard progress", () => {
  it("counts Hire, Reject and Hold as decided", () => {
    const progress = { ...emptyProgress(), hr_round: 4, manager_round: 2, hire: 3, rejected: 2, on_hold: 1 };
    expect(decidedCount(progress)).toBe(6);
  });
});
