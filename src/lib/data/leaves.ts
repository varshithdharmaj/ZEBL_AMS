import type { LeaveWorkflowStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getLeaveBalanceSummaries, getLeaveTransactionHistory } from "@/lib/leave";
import { leaveRequestWithStepsInclude } from "@/lib/leave/leave-request-include";

// Rows written by a hand-run data fix carry a technical note meant for HR and
// developers. Employees see a plain label instead; HR still sees the full note
// on the employee record.
const DATA_FIX_AUTHOR = "system-migration";

export async function getEmployeeLeavePageData(employeeId: number) {
  // Balances first: with processAccruals they write any due accruals, which
  // the history should then include.
  const balances = await getLeaveBalanceSummaries(employeeId, { processAccruals: true });
  const [leaves, history] = await Promise.all([
    getLeaveRequests("employee", employeeId),
    getLeaveTransactionHistory(employeeId),
  ]);

  return {
    balances,
    leaves,
    history: history.map((row) =>
      row.updatedBy === DATA_FIX_AUTHOR
        ? { ...row, reason: "Balance correction", updatedBy: "system" }
        : row
    ),
  };
}

export async function getLeaveRequests(
  scope: "admin" | "employee",
  employeeId?: number,
  filters?: { workflowStatus?: string; q?: string }
) {
  const where = {
    ...(scope === "employee" && employeeId ? { employeeId } : {}),
    ...(filters?.workflowStatus
      ? { workflowStatus: filters.workflowStatus as LeaveWorkflowStatus }
      : {}),
    ...(filters?.q
      ? {
          OR: [
            { reason: { contains: filters.q, mode: "insensitive" as const } },
            { employee: { name: { contains: filters.q, mode: "insensitive" as const } } },
            { employee: { employeeCode: { contains: filters.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  return prisma.leaveRequest.findMany({
    where,
    include: leaveRequestWithStepsInclude,
    orderBy: { createdAt: "desc" },
  });
}
