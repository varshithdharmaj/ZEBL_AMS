import { beforeEach, describe, expect, it, vi } from "vitest";

const memberFindFirst = vi.fn();
const appFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    hiringBatchMember: { findFirst: (...a: unknown[]) => memberFindFirst(...a) },
    application: { findFirst: (...a: unknown[]) => appFindFirst(...a) },
  },
}));

import { assertManagerCanDecide } from "@/lib/recruitment/batch/batch-access";

function setup(inBatch: boolean, app: { currentStage: string; status: string } | null) {
  memberFindFirst.mockResolvedValue(inBatch ? { id: "m1" } : null);
  appFindFirst.mockResolvedValue(app);
}

describe("what a shared batch's manager may do", () => {
  beforeEach(() => vi.clearAllMocks());

  it("decides for people in the Manager Round", async () => {
    setup(true, { currentStage: "manager_round", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "decision")).resolves.toBeUndefined();
    await expect(assertManagerCanDecide("u1", "a1", "on_hold")).resolves.toBeUndefined();
    await expect(assertManagerCanDecide("u1", "a1", "reject")).resolves.toBeUndefined();
    await expect(assertManagerCanDecide("u1", "a1", "rate")).resolves.toBeUndefined();
  });

  it("can't act on batches not shared with them", async () => {
    setup(false, { currentStage: "manager_round", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "decision")).rejects.toThrow("isn't in a batch shared with you");
  });

  it("can't decide for people still with HR", async () => {
    setup(true, { currentStage: "hr_round", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "decision")).rejects.toThrow("Manager Round");
    await expect(assertManagerCanDecide("u1", "a1", "reject")).rejects.toThrow("Manager Round");
  });

  it("can't move people anywhere else (e.g. to an offer or back to HR)", async () => {
    setup(true, { currentStage: "manager_round", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "offer")).rejects.toThrow("only Hire, Reject or Hold");
    await expect(assertManagerCanDecide("u1", "a1", "hr_round")).rejects.toThrow("only Hire, Reject or Hold");
  });

  it("can undo a Hire or Hold back to the Manager Round, but not once offered", async () => {
    setup(true, { currentStage: "decision", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "manager_round")).resolves.toBeUndefined();
    setup(true, { currentStage: "on_hold", status: "on_hold" });
    await expect(assertManagerCanDecide("u1", "a1", "manager_round")).resolves.toBeUndefined();
    setup(true, { currentStage: "offer", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "manager_round")).rejects.toThrow("can't be moved back");
  });

  it("saves the hire decision only right after Hire", async () => {
    setup(true, { currentStage: "decision", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "hire_decision")).resolves.toBeUndefined();
    setup(true, { currentStage: "manager_round", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "hire_decision")).rejects.toThrow("Hire them first");
  });

  it("reopens only rejected people", async () => {
    setup(true, { currentStage: "manager_round", status: "rejected" });
    await expect(assertManagerCanDecide("u1", "a1", "reopen")).resolves.toBeUndefined();
    setup(true, { currentStage: "manager_round", status: "active" });
    await expect(assertManagerCanDecide("u1", "a1", "reopen")).rejects.toThrow("rejected");
  });
});
