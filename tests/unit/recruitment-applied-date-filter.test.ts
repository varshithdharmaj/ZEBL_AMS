import { describe, expect, it, vi, beforeEach } from "vitest";

const applicationCount = vi.fn(async () => 0);
const applicationFindMany = vi.fn(async () => []);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    application: {
      count: (...args: unknown[]) => applicationCount(...args),
      findMany: (...args: unknown[]) => applicationFindMany(...args),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import {
  prismaApplicationRepository,
  appliedDateWhere,
} from "@/lib/recruitment/repositories/prisma-application-repository";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";

describe("appliedDateWhere — hiring batch filter", () => {
  it("treats both ends as inclusive IST calendar days", () => {
    expect(appliedDateWhere("2026-01-01", "2026-01-31")).toEqual({
      gte: new Date("2025-12-31T18:30:00.000Z"),
      lt: new Date("2026-01-31T18:30:00.000Z"),
    });
  });

  it("supports open-ended ranges", () => {
    expect(appliedDateWhere("2026-03-01", undefined)).toEqual({
      gte: new Date("2026-02-28T18:30:00.000Z"),
    });
    expect(appliedDateWhere(undefined, "2026-03-01")).toEqual({
      lt: new Date("2026-03-01T18:30:00.000Z"),
    });
  });

  it("ignores missing or malformed dates", () => {
    expect(appliedDateWhere(undefined, undefined)).toBeUndefined();
    expect(appliedDateWhere("not-a-date", "2026-13-45")).toBeUndefined();
  });
});

describe("prismaApplicationRepository — applied date filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes listApplications to the batch window on createdAt", async () => {
    await prismaApplicationRepository.listApplications({
      scope: unrestrictedRecruitmentScope(),
      filters: { jobOpeningId: "job_1", appliedFrom: "2026-09-01" },
      pagination: { page: 1, pageSize: 25 },
    });

    const call = applicationFindMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } };
    expect(call.where.AND[1]).toMatchObject({
      jobOpeningId: "job_1",
      createdAt: { gte: new Date("2026-08-31T18:30:00.000Z") },
    });
  });
});
