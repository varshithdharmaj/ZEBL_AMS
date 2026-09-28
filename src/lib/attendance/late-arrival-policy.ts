import "server-only";

import { LeaveWorkflowStatus, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { deductLeaveForApproval, getOrCreateLeaveBalanceRow } from "@/lib/leave";
import { isLateCheckIn } from "@/lib/attendance/shift-lookup";
import { getLateArrivalPolicySettings } from "@/lib/attendance/late-arrival-policy-settings";
import { workflowToLeaveStatus } from "@/lib/workflow/workflow-status";
import { cancelWorkflow } from "@/lib/workflow/leave-workflow";
import type { WorkflowActor } from "@/lib/workflow/workflow-types";
import type { ShiftSummary } from "@/lib/shifts";

type Tx = Prisma.TransactionClient;

export const SYSTEM_LATE_ARRIVAL_ACTOR = "System (Late Arrival Policy)";
const HALF_DAY = 0.5;

export type LateArrivalEvaluationInput = {
  employeeId: number;
  /** The AttendanceRecord's own attendanceDate key (midnight IST). */
  attendanceDate: Date;
  /** IST calendar month of attendanceDate, e.g. "2026-09" — the free-lates counter window. */
  monthKey: string;
  checkIn: string | null;
  shift: ShiftSummary | null;
  /** True when an approved Attendance Regularization already governs this day. */
  isRegularized: boolean;
};

export type LateArrivalEvaluationResult = {
  triggeredHalfDay: boolean;
  leaveRequestId: number | null;
};

const NOT_TRIGGERED: LateArrivalEvaluationResult = { triggeredHalfDay: false, leaveRequestId: null };

/**
 * Evaluates one day's attendance under LateArrivalPolicySettings and, once the
 * employee's free-lates allowance for the month is used up, auto-applies a
 * 0.5-day leave. Idempotent — guarded by LateArrivalPenalty's
 * unique(employeeId, attendanceDate) — so it is safe to call every time
 * deriveAttendanceForEmployeeDate re-runs for the same day (e.g. a later
 * checkout punch arriving). Never evaluates a day before the policy's
 * enabledAt cutoff, so enabling the policy never rewrites past attendance or
 * leave history. Must only be called for a day with no active regularization
 * — a regularized day's check-in time is HR-corrected, not the raw punch.
 */
export async function evaluateLateArrivalPolicy(
  tx: Tx,
  input: LateArrivalEvaluationInput
): Promise<LateArrivalEvaluationResult> {
  const { employeeId, attendanceDate, monthKey, checkIn, shift, isRegularized } = input;

  const settings = await getLateArrivalPolicySettings();
  if (!settings.enabled || !settings.enabledAt) return NOT_TRIGGERED;
  if (attendanceDate.getTime() < settings.enabledAt.getTime()) return NOT_TRIGGERED;
  if (isRegularized) return NOT_TRIGGERED;
  if (!isLateCheckIn(checkIn, shift)) return NOT_TRIGGERED;

  const alreadyEvaluated = await tx.lateArrivalPenalty.findUnique({
    where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
  });
  if (alreadyEvaluated) return NOT_TRIGGERED;

  const priorThisMonth = await tx.lateArrivalPenalty.count({
    where: { employeeId, monthKey },
  });
  const occurrenceInMonth = priorThisMonth + 1;
  const triggeredHalfDay = occurrenceInMonth > settings.freeLatesPerMonth;

  const penalty = await tx.lateArrivalPenalty.create({
    data: {
      employeeId,
      attendanceDate,
      monthKey,
      occurrenceInMonth,
      freeLatesAllowed: settings.freeLatesPerMonth,
      triggeredHalfDay,
    },
  });

  if (!triggeredHalfDay) return NOT_TRIGGERED;

  const leaveRequestId = await applyAutoHalfDayLeave(tx, {
    employeeId,
    attendanceDate,
    occurrenceInMonth,
  });

  await tx.lateArrivalPenalty.update({
    where: { id: penalty.id },
    data: { leaveRequestId },
  });

  await writeAuditLog(
    {
      entityType: "leave_request",
      entityId: String(leaveRequestId),
      action: AUDIT_ACTIONS.LATE_ARRIVAL_HALF_DAY_APPLIED,
      actorEmail: SYSTEM_LATE_ARRIVAL_ACTOR,
      employeeId,
      module: "attendance",
      metadata: {
        attendanceDate: attendanceDate.toISOString(),
        monthKey,
        occurrenceInMonth,
        freeLatesAllowed: settings.freeLatesPerMonth,
      },
    },
    tx
  );

  return { triggeredHalfDay: true, leaveRequestId };
}

/**
 * Auto-approved 0.5-day CL request, mirroring what finalizeApproval
 * (src/lib/workflow/leave-workflow.ts) leaves behind for a manually-approved
 * request — same terminal fields, same balance-deduction call — so this reads
 * and reports identically to any other leave everywhere else in the app.
 * Falls back to full loss-of-pay if the CL balance can't cover it.
 */
async function applyAutoHalfDayLeave(
  tx: Tx,
  params: { employeeId: number; attendanceDate: Date; occurrenceInMonth: number }
): Promise<number> {
  const { employeeId, attendanceDate, occurrenceInMonth } = params;

  const balance = await getOrCreateLeaveBalanceRow(employeeId, tx);
  let lopDays = balance.clBalance >= HALF_DAY ? 0 : HALF_DAY;

  const now = new Date();
  const leave = await tx.leaveRequest.create({
    data: {
      employeeId,
      leaveType: "CL",
      startDate: attendanceDate,
      endDate: attendanceDate,
      days: HALF_DAY,
      lopDays,
      reason: `Auto-applied: late arrival beyond shift grace period (occurrence #${occurrenceInMonth} this month).`,
      status: workflowToLeaveStatus(LeaveWorkflowStatus.approved),
      workflowStatus: LeaveWorkflowStatus.approved,
      submittedAt: now,
      finalApprovedAt: now,
      reviewedBy: SYSTEM_LATE_ARRIVAL_ACTOR,
      reviewedAt: now,
    },
  });

  const payableDays = HALF_DAY - lopDays;
  if (payableDays > 0) {
    try {
      await deductLeaveForApproval({
        employeeId,
        leaveType: "CL",
        days: payableDays,
        leaveRequestId: leave.id,
        createdBy: SYSTEM_LATE_ARRIVAL_ACTOR,
        tx,
      });
    } catch {
      // Balance moved between our read above and the conditional decrement
      // (e.g. a concurrent manual leave approval) — fall back to full LOP
      // rather than failing the whole attendance derivation transaction.
      lopDays = HALF_DAY;
      await tx.leaveRequest.update({ where: { id: leave.id }, data: { lopDays } });
    }
  }

  return leave.id;
}

/**
 * Reverses an auto-applied half-day once HR approves an Attendance
 * Regularization for the same date — the employee's contest path. Called
 * after approveRegularizationRequest's own transaction has already committed
 * (cancelWorkflow opens its own transaction and can't be folded into that
 * one), so this is deliberately best-effort: a failure here never surfaces as
 * a failed regularization approval, it just leaves the LateArrivalPenalty row
 * unreversed for manual reconciliation.
 */
export async function reverseLateArrivalPenaltyForRegularization(params: {
  employeeId: number;
  attendanceDate: Date;
  regularizationRequestId: number;
  actor: WorkflowActor;
}): Promise<void> {
  const { employeeId, attendanceDate, regularizationRequestId, actor } = params;

  try {
    const penalty = await prisma.lateArrivalPenalty.findUnique({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    });
    if (!penalty || !penalty.triggeredHalfDay || penalty.reversedAt || !penalty.leaveRequestId) {
      return;
    }

    await cancelWorkflow(
      penalty.leaveRequestId,
      actor,
      `Reversed: attendance regularization #${regularizationRequestId} approved for this date.`
    );

    await prisma.lateArrivalPenalty.update({
      where: { id: penalty.id },
      data: { reversedAt: new Date(), reversedByRegularizationId: regularizationRequestId },
    });

    await writeAuditLog({
      entityType: "leave_request",
      entityId: String(penalty.leaveRequestId),
      action: AUDIT_ACTIONS.LATE_ARRIVAL_HALF_DAY_REVERSED,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      employeeId,
      module: "attendance",
      metadata: {
        attendanceDate: attendanceDate.toISOString(),
        regularizationRequestId,
      },
    });
  } catch (err) {
    console.error("[late-arrival-policy] failed to reverse auto half-day:", err);
  }
}
