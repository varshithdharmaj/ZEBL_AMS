import { describe, expect, it, vi } from "vitest";
import { RecruitmentPipelineStage, StageCategory } from "@/generated/prisma/enums";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const INT_MAX = 2_147_483_647;

type Row = { id: string; sortOrder: number; isArchived: boolean };

/**
 * Just enough of `tx.jobOpeningStage` for insertJobStage, enforcing what
 * Postgres enforces: sortOrder is an INT and unique per job.
 */
function fakeTx(rows: Row[]) {
  const check = (row: Row | null, value: number) => {
    if (value > INT_MAX) throw new Error(`value "${value}" is out of range for type integer`);
    if (rows.some((r) => r !== row && r.sortOrder === value)) throw new Error(`duplicate sortOrder ${value}`);
  };
  return {
    jobOpeningStage: {
      aggregate: async () => ({
        _max: { sortOrder: rows.length ? Math.max(...rows.map((r) => r.sortOrder)) : null },
      }),
      create: async ({ data }: { data: { sortOrder: number } }) => {
        check(null, data.sortOrder);
        rows.push({ id: "new", sortOrder: data.sortOrder, isArchived: false });
        return { id: "new" };
      },
      findMany: async ({ where }: { where: { isArchived?: boolean } }) =>
        rows
          .filter((r) => where.isArchived === undefined || r.isArchived === where.isArchived)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((r) => ({ id: r.id })),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { sortOrder: number | { increment: number } };
      }) => {
        const row = rows.find((r) => r.id === where.id)!;
        const next = typeof data.sortOrder === "number" ? data.sortOrder : row.sortOrder + data.sortOrder.increment;
        check(row, next);
        row.sortOrder = next;
      },
    },
  };
}

describe("insertJobStage", () => {
  it("adds a column between two others and renumbers the job's columns", async () => {
    const rows: Row[] = [
      { id: "applied", sortOrder: 0, isArchived: false },
      { id: "screening", sortOrder: 1, isArchived: false },
      { id: "assessment", sortOrder: 2, isArchived: false },
      { id: "old", sortOrder: 3, isArchived: true },
    ];

    await prismaJobRepository.insertJobStage(
      "job-1",
      {
        stage: RecruitmentPipelineStage.custom_1,
        category: StageCategory.INTERVIEW,
        label: "CEO Round",
        afterStageId: "screening",
        beforeStageId: "assessment",
      },
      fakeTx(rows) as never
    );

    const order = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(order.map((r) => r.id)).toEqual(["applied", "screening", "new", "assessment", "old"]);
    expect(order.map((r) => r.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });
});
