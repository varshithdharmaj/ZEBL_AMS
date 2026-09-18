import { LeaveRequestStatus, LeaveWorkflowStatus, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  countLeaveDays,
  deductLeaveForApproval,
  processPendingLeaveAccruals,
  restoreLeaveBalanceForCancellation,
} from "@/lib/leave";
import { getOrCreateLeaveBalanceRow } from "@/lib/leave/balance-row";
import { consumeElFifo, restoreElForCancellation } from "@/lib/leave/el-fifo";
import { runElAccrualForEmployeeInTx } from "@/lib/leave/el-accrual-engine";
import { getLeavePolicySettings } from "@/lib/leave/leave-policy";
import { isValidLeaveType, leaveTypeToBalanceField, type LeaveType } from "@/lib/leave-types";
import type { WorkflowActor } from "@/lib/workflow/workflow-types";

type TxClient = Prisma.TransactionClient;

export class HistoricalLeaveEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoricalLeaveEntryError";
  }
}

type HistoricalEntryInput = {
  employeeId: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  actor: WorkflowActor;
};

type HistoricalEntryResult = {
  leaveId: number;
  days: number;
  payableDays: number;
  lopDays: number;
};

function validateInput(input: HistoricalEntryInput): asserts input is HistoricalEntryInput & { leaveType: LeaveType } {
  if (!isValidLeaveType(input.leaveType)) {
    throw new HistoricalLeaveEntryError("Please select a valid leave type (EL, CL, or SL).");
  }
  if (Number.isNaN(input.startDate.getTime()) || Number.isNaN(input.endDate.getTime())) {
    throw new HistoricalLeaveEntryError("Valid start and end dates are required.");
  }
  if (input.endDate < input.startDate) {
    throw new HistoricalLeaveEntryError("End date cannot be before start date.");
  }
  if (!input.reason.trim()) {
    throw new HistoricalLeaveEntryError("Reason is required.");
  }
}

/**
 * Shared core: creates an already-approved LeaveRequest for a period before
 * go-live and deducts the balance through the same primitives a live approval
 * uses (consumeElFifo / deductLeaveForApproval) — never the approval-step
 * workflow, since it records something that already happened. Excess over the
 * available balance is recorded as LOP rather than rejected, same as a live
 * request (see applyLeaveAction) — a historical fact isn't something to block.
 * No notification/calendar-sync side effects: those exist for live requests
 * an approver is waiting on, not for something HR is recording after the fact.
 */
async function createHistoricalLeaveEntryInTx(
  tx: TxClient,
  input: HistoricalEntryInput & { leaveType: LeaveType; previousRequestId?: number }
): Promise<HistoricalEntryResult> {
  const { employeeId, leaveType, startDate, endDate, reason, actor, previousRequestId } = input;

  const days = countLeaveDays(startDate, endDate);
  if (days <= 0) {
    throw new HistoricalLeaveEntryError("The selected date range contains no leave days.");
  }

  await processPendingLeaveAccruals(employeeId, tx);

  if (leaveType === "EL") {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new HistoricalLeaveEntryError("Employee not found.");
    const policy = await getLeavePolicySettings();
    await runElAccrualForEmployeeInTx(
      tx,
      { id: employee.id, joiningDate: employee.joiningDate, isActive: employee.isActive },
      policy
    );
  }

  const balance = await getOrCreateLeaveBalanceRow(employeeId, tx);
  const available = Math.max(0, balance[leaveTypeToBalanceField(leaveType)]);
  const payableDays = Math.min(days, available);
  const lopDays = days - payableDays;

  const now = new Date();
  const leave = await tx.leaveRequest.create({
    data: {
      employeeId,
      leaveType,
      startDate,
      endDate,
      days,
      lopDays,
      reason,
      status: LeaveRequestStatus.approved,
      workflowStatus: LeaveWorkflowStatus.approved,
      submittedAt: now,
      finalApprovedAt: now,
      reviewedBy: actor.email,
      reviewedAt: now,
      isHistoricalEntry: true,
      previousRequestId: previousRequestId ?? null,
    },
  });

  if (payableDays > 0) {
    if (leaveType === "EL") {
      await consumeElFifo(tx, {
        employeeId,
        days: payableDays,
        leaveRequestId: leave.id,
        createdBy: actor.email,
      });
    } else {
      await deductLeaveForApproval({
        employeeId,
        leaveType,
        days: payableDays,
        leaveRequestId: leave.id,
        createdBy: actor.email,
        tx,
      });
    }
  }

  return { leaveId: leave.id, days, payableDays, lopDays };
}

export async function createHistoricalLeaveEntry(
  input: HistoricalEntryInput
): Promise<HistoricalEntryResult> {
  validateInput(input);

  const result = await prisma.$transaction((tx) => createHistoricalLeaveEntryInTx(tx, input));

  await writeAuditLog({
    entityType: "leave_request",
    entityId: String(result.leaveId),
    action: AUDIT_ACTIONS.LEAVE_HISTORICAL_ENTRY_ADDED,
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    employeeId: input.employeeId,
    module: "leave",
    metadata: {
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      days: result.days,
      payableDays: result.payableDays,
      lopDays: result.lopDays,
    },
  });

  return result;
}

/**
 * Corrects a historical entry by reversing its balance impact and marking it
 * cancelled, then creating a fresh corrected entry linked back via
 * previousRequestId — the original row is never rewritten in place, so the
 * ledger stays a true record of what HR entered and when.
 */
export async function editHistoricalLeaveEntry(
  input: HistoricalEntryInput & { leaveRequestId: number }
): Promise<HistoricalEntryResult> {
  validateInput(input);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.leaveRequest.findUnique({ where: { id: input.leaveRequestId } });
    if (!existing) {
      throw new HistoricalLeaveEntryError("Historical leave entry not found.");
    }
    if (!existing.isHistoricalEntry) {
      throw new HistoricalLeaveEntryError("Only HR-backfilled historical entries can be corrected here.");
    }
    if (existing.workflowStatus !== LeaveWorkflowStatus.approved) {
      throw new HistoricalLeaveEntryError("This entry has already been corrected or cancelled.");
    }
    if (existing.employeeId !== input.employeeId) {
      throw new HistoricalLeaveEntryError("Entry does not belong to this employee.");
    }
    if (!isValidLeaveType(existing.leaveType)) {
      throw new HistoricalLeaveEntryError("Existing entry has an invalid leave type.");
    }

    const alreadyCorrected = await tx.leaveRequest.findUnique({
      where: { previousRequestId: existing.id },
    });
    if (alreadyCorrected) {
      throw new HistoricalLeaveEntryError("This entry has already been corrected.");
    }

    const oldPayableDays = existing.days - existing.lopDays;
    if (oldPayableDays > 0) {
      if (existing.leaveType === "EL") {
        await restoreElForCancellation(tx, {
          employeeId: existing.employeeId,
          leaveRequestId: existing.id,
          createdBy: input.actor.email,
          reason: "Superseded by a corrected historical entry",
        });
      } else {
        await restoreLeaveBalanceForCancellation({
          employeeId: existing.employeeId,
          leaveType: existing.leaveType,
          days: oldPayableDays,
          leaveRequestId: existing.id,
          createdBy: input.actor.email,
          reason: "Superseded by a corrected historical entry",
          tx,
        });
      }
    }

    const now = new Date();
    await tx.leaveRequest.update({
      where: { id: existing.id },
      data: {
        workflowStatus: LeaveWorkflowStatus.cancelled,
        status: LeaveRequestStatus.cancelled,
        rejectionReason: "Corrected by HR",
        cancelledAt: now,
      },
    });

    return createHistoricalLeaveEntryInTx(tx, { ...input, previousRequestId: existing.id });
  });

  await writeAuditLog({
    entityType: "leave_request",
    entityId: String(result.leaveId),
    action: AUDIT_ACTIONS.LEAVE_HISTORICAL_ENTRY_CORRECTED,
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    employeeId: input.employeeId,
    module: "leave",
    metadata: {
      previousRequestId: input.leaveRequestId,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      days: result.days,
      payableDays: result.payableDays,
      lopDays: result.lopDays,
    },
  });

  return result;
}
