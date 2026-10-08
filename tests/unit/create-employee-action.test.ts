import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, initializeEmployeeLeaveBalances, loggerError } = vi.hoisted(() => ({
  prisma: {
    employee: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  initializeEmployeeLeaveBalances: vi.fn(async () => {}),
  loggerError: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({
  requireManageEmployeeSession: vi.fn(async () => ({ id: "u1", email: "hr@zebl.test", role: "hr" })),
  getSessionOrThrow: vi.fn(),
}));
vi.mock("@/lib/leave", () => ({
  initializeEmployeeLeaveBalances,
}));
vi.mock("@/lib/leave/el-fifo", () => ({ seedInitialElLot: vi.fn() }));
vi.mock("@/lib/audit", () => ({ AUDIT_ACTIONS: {}, writeAuditLog: vi.fn() }));
vi.mock("@/lib/integrations/biometric-ingestion", () => ({
  backfillBiometricPunchesForEmployee: vi.fn(),
}));
vi.mock("@/lib/observability/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createEmployeeAction } from "@/actions/employees";

function form(): FormData {
  const fd = new FormData();
  fd.set("employeeCode", "ZT-101");
  fd.set("name", "Test Person");
  fd.set("joiningDate", "2026-09-30");
  fd.set("employeeStatus", "Active");
  return fd;
}

function prismaError(code: string, meta: Record<string, unknown>) {
  return Object.assign(new Error(`Prisma ${code}`), { code, meta });
}

describe("createEmployeeAction failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.employee.findUnique.mockResolvedValue(null);
  });

  it("reports the database cause and a Ref when the employee insert fails", async () => {
    prisma.employee.create.mockRejectedValue(prismaError("P2002", { target: "employees_pkey" }));

    const result = await createEmployeeAction({}, form());

    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/^Failed to create employee: a duplicate value was rejected by the database \(employees_pkey\)\. \(Ref: employee-create-/);
    expect(loggerError).toHaveBeenCalledWith(
      "employee.create_failed",
      expect.objectContaining({
        employeeCode: "ZT-101",
        employeeCreated: false,
        prismaCode: "P2002",
        message: "Prisma P2002",
      })
    );
  });

  it("says the employee was saved when a later setup step fails", async () => {
    prisma.employee.create.mockResolvedValue({ id: 42, employeeCode: "ZT-101" });
    initializeEmployeeLeaveBalances.mockRejectedValueOnce(
      prismaError("P2021", { table: "public.el_accrual_lots" })
    );

    const result = await createEmployeeAction({}, form());

    expect(result.error).toMatch(/^The employee was saved, but finishing setup failed: a database table is missing \(public\.el_accrual_lots\)\./);
    expect(result.error).toContain("(Ref: employee-create-");
    expect(loggerError).toHaveBeenCalledWith(
      "employee.create_failed",
      expect.objectContaining({ entityId: "42", employeeCreated: true, prismaCode: "P2021" })
    );
  });
});
