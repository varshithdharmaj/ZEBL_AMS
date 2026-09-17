import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApprovalStepStatus,
  ApproverRole,
  LeaveWorkflowStatus,
} from "@/generated/prisma/client";

const emitWorkflowNotification = vi.fn(async () => undefined);
const writeAuditLog = vi.fn(async () => undefined);
const processPendingLeaveAccruals = vi.fn(async () => undefined);
const deductLeaveForApproval = vi.fn(async () => undefined);
const restoreLeaveBalanceForCancellation = vi.fn(async () => undefined);
const consumeElFifo = vi.fn(async () => undefined);
const restoreElForCancellation = vi.fn(async () => undefined);
const runElAccrualForEmployeeInTx = vi.fn(async () => undefined);
const canUserApproveStep = vi.fn(() => true);
const canUserRejectStep = vi.fn(() => true);
const canAccessAdmin = vi.fn(() => true);

vi.mock("@/lib/workflow/notification-hooks", () => ({
  emitWorkflowNotification: (...args: unknown[]) => emitWorkflowNotification(...args),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    LEAVE_STEP_APPROVED: "leave.step_approved",
    LEAVE_STATUS_CHANGED: "leave.status_changed",
    LEAVE_REJECTED: "leave.rejected",
    LEAVE_WITHDRAWN: "leave.withdrawn",
    LEAVE_CANCELLED: "leave.cancelled",
    LEAVE_SUBMITTED: "leave.submitted",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/leave", () => ({
  countLeaveDays: () => 3,
  processPendingLeaveAccruals: (...args: unknown[]) => processPendingLeaveAccruals(...args),
  deductLeaveForApproval: (...args: unknown[]) => deductLeaveForApproval(...args),
  restoreLeaveBalanceForCancellation: (...args: unknown[]) =>
    restoreLeaveBalanceForCancellation(...args),
}));

vi.mock("@/lib/leave/el-fifo", () => ({
  consumeElFifo: (...args: unknown[]) => consumeElFifo(...args),
  restoreElForCancellation: (...args: unknown[]) => restoreElForCancellation(...args),
}));

vi.mock("@/lib/leave/el-accrual-engine", () => ({
  runElAccrualForEmployeeInTx: (...args: unknown[]) => runElAccrualForEmployeeInTx(...args),
}));

vi.mock("@/lib/leave/leave-policy", () => ({
  getLeavePolicySettings: async () => ({}),
}));

vi.mock("@/lib/workflow/step-authorization", () => ({
  canUserApproveStep: (...args: unknown[]) => canUserApproveStep(...args),
  canUserRejectStep: (...args: unknown[]) => canUserRejectStep(...args),
  isSuperAdminWorkflowOverride: () => false,
}));

vi.mock("@/lib/permissions", () => ({
  canAccessAdmin: (...args: unknown[]) => canAccessAdmin(...args),
}));

vi.mock("@/lib/leave/leave-request-include", () => ({
  leaveRequestWithStepsInclude: {},
}));

const leaveRequestUpdateMany = vi.fn();
const leaveRequestUpdate = vi.fn();
const leaveRequestFindUnique = vi.fn();
const leaveApprovalStepUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      findUnique: (...args: unknown[]) => leaveRequestFindUnique(...args),
      updateMany: (...args: unknown[]) => leaveRequestUpdateMany(...args),
      update: (...args: unknown[]) => leaveRequestUpdate(...args),
    },
    leaveApprovalStep: {
      updateMany: (...args: unknown[]) => leaveApprovalStepUpdateMany(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        leaveRequest: {
          findUnique: (...args: unknown[]) => leaveRequestFindUnique(...args),
          updateMany: (...args: unknown[]) => leaveRequestUpdateMany(...args),
          update: (...args: unknown[]) => leaveRequestUpdate(...args),
        },
        leaveApprovalStep: {
          updateMany: (...args: unknown[]) => leaveApprovalStepUpdateMany(...args),
        },
      };
      return fn(tx);
    },
  },
}));

import { advanceWorkflow, cancelWorkflow } from "@/lib/workflow/leave-workflow";

const actor = {
  userId: "u-mgr",
  email: "mgr@test.local",
  role: "employee" as const,
  employeeId: 50,
};

const hrActor = {
  userId: "u-hr",
  email: "hr@test.local",
  role: "hr" as const,
  employeeId: 99,
};

function pendingLeave(overrides: Partial<{ leaveType: string; days: number; lopDays: number }> = {}) {
  const stepId = 10;
  return {
    id: 1,
    employeeId: 200,
    leaveType: overrides.leaveType ?? "CL",
    startDate: new Date("2026-08-01"),
    endDate: new Date("2026-08-03"),
    days: overrides.days ?? 3,
    lopDays: overrides.lopDays ?? 0,
    reason: "Trip",
    workflowStatus: LeaveWorkflowStatus.pending_approval,
    status: "pending",
    version: 5,
    currentStepId: stepId,
    currentStep: {
      id: stepId,
      stepOrder: 1,
      approverId: 50,
      approverRole: ApproverRole.team_lead,
      status: ApprovalStepStatus.pending,
      approver: { name: "Mgr" },
    },
    approvalSteps: [
      {
        id: stepId,
        stepOrder: 1,
        approverId: 50,
        approverRole: ApproverRole.team_lead,
        status: ApprovalStepStatus.pending,
        approver: { name: "Mgr" },
      },
    ],
    employee: { name: "Emp", employeeCode: "E1", joiningDate: new Date("2020-01-01"), isActive: true },
  };
}

function approvedLeave(overrides: Partial<{ leaveType: string; days: number; lopDays: number }> = {}) {
  return { ...pendingLeave(overrides), workflowStatus: LeaveWorkflowStatus.approved };
}

describe("auto-LOP on balance exhaustion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canUserApproveStep.mockReturnValue(true);
    canAccessAdmin.mockReturnValue(true);
    leaveRequestUpdateMany.mockResolvedValue({ count: 1 });
    leaveApprovalStepUpdateMany.mockResolvedValue({ count: 1 });
    leaveRequestUpdate.mockResolvedValue({});
  });

  it("fully-LOP CL request: deducts nothing, still approves", async () => {
    const leave = pendingLeave({ leaveType: "CL", days: 3, lopDays: 3 });
    leaveRequestFindUnique.mockResolvedValueOnce(leave).mockResolvedValueOnce(leave);

    const result = await advanceWorkflow(1, actor, 5);

    expect(result.workflowStatus).toBe(LeaveWorkflowStatus.approved);
    expect(deductLeaveForApproval).not.toHaveBeenCalled();
  });

  it("partially-LOP CL request: deducts only the payable portion", async () => {
    const leave = pendingLeave({ leaveType: "CL", days: 3, lopDays: 1 });
    leaveRequestFindUnique.mockResolvedValueOnce(leave).mockResolvedValueOnce(leave);

    await advanceWorkflow(1, actor, 5);

    expect(deductLeaveForApproval).toHaveBeenCalledTimes(1);
    expect(deductLeaveForApproval).toHaveBeenCalledWith(
      expect.objectContaining({ days: 2, leaveRequestId: 1 })
    );
  });

  it("fully-LOP EL request: consumes no lots (still runs accrual catch-up)", async () => {
    const leave = pendingLeave({ leaveType: "EL", days: 3, lopDays: 3 });
    leaveRequestFindUnique.mockResolvedValueOnce(leave).mockResolvedValueOnce(leave);

    const result = await advanceWorkflow(1, actor, 5);

    expect(result.workflowStatus).toBe(LeaveWorkflowStatus.approved);
    expect(runElAccrualForEmployeeInTx).toHaveBeenCalledTimes(1);
    expect(consumeElFifo).not.toHaveBeenCalled();
  });

  it("partially-LOP EL request: consumes only the payable portion of lots", async () => {
    const leave = pendingLeave({ leaveType: "EL", days: 3, lopDays: 1 });
    leaveRequestFindUnique.mockResolvedValueOnce(leave).mockResolvedValueOnce(leave);

    await advanceWorkflow(1, actor, 5);

    expect(consumeElFifo).toHaveBeenCalledTimes(1);
    expect(consumeElFifo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ days: 2, leaveRequestId: 1 })
    );
  });

  it("no-LOP request behaves exactly as before (full days deducted)", async () => {
    const leave = pendingLeave({ leaveType: "CL", days: 3, lopDays: 0 });
    leaveRequestFindUnique.mockResolvedValueOnce(leave).mockResolvedValueOnce(leave);

    await advanceWorkflow(1, actor, 5);

    expect(deductLeaveForApproval).toHaveBeenCalledWith(
      expect.objectContaining({ days: 3 })
    );
  });
});

describe("cancellation restores only the payable portion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canAccessAdmin.mockReturnValue(true);
    leaveRequestUpdateMany.mockResolvedValue({ count: 1 });
    leaveRequestUpdate.mockResolvedValue({});
  });

  it("partially-LOP CL: restores only the payable days, not the full request", async () => {
    const leave = approvedLeave({ leaveType: "CL", days: 3, lopDays: 1 });
    leaveRequestFindUnique.mockResolvedValue(leave);

    await cancelWorkflow(1, hrActor, "Employee returned early");

    expect(restoreLeaveBalanceForCancellation).toHaveBeenCalledTimes(1);
    expect(restoreLeaveBalanceForCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ days: 2, leaveRequestId: 1 })
    );
  });

  it("fully-LOP CL: restores nothing (nothing was ever deducted)", async () => {
    const leave = approvedLeave({ leaveType: "CL", days: 3, lopDays: 3 });
    leaveRequestFindUnique.mockResolvedValue(leave);

    await cancelWorkflow(1, hrActor, "Employee returned early");

    expect(restoreLeaveBalanceForCancellation).not.toHaveBeenCalled();
  });

  it("EL cancellation always delegates to restoreElForCancellation (no-op is its own responsibility)", async () => {
    const leave = approvedLeave({ leaveType: "EL", days: 3, lopDays: 3 });
    leaveRequestFindUnique.mockResolvedValue(leave);

    await cancelWorkflow(1, hrActor, "Employee returned early");

    expect(restoreElForCancellation).toHaveBeenCalledTimes(1);
  });
});
