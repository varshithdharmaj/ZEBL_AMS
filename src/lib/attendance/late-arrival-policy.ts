import "server-only";

import { LeaveWorkflowStatus, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  deductLeaveForApproval,
  getOrCreateLeaveBalanceRow,
  processPendingLeaveAccruals,
} from "@/lib/leave";
import { getAttendanceSettings } from "@/lib/attendance/attendance-settings";
import { resolveEffectiveScheduleType, type WeeklySchedule } from "@/lib/attendance/schedule-resolver";
import { getShiftMap, isLateCheckIn } from "@/lib/attendance/shift-lookup";
import {
  getLateArrivalPolicySettings,
  type LateArrivalPolicySettingsRow,
} from "@/lib/attendance/late-arrival-policy-settings";
import { logger } from "@/lib/observability/logger";
import { startOfDay } from "@/lib/utils";
import { workflowToLeaveStatus } from "@/lib/workflow/workflow-status";
import { cancelWorkflow } from "@/lib/workflow/leave-workflow";
import type { WorkflowActor } from "@/lib/workflow/workflow-types";
import type { ShiftSummary } from "@/lib/shifts";

type Tx = Prisma.TransactionClient;

export const SYSTEM_LATE_ARRIVAL_ACTOR = "System (Late Arrival Policy)";
const HALF_DAY = 0.5;

/** Leave already on the day (approved or still awaiting approval) explains a late
 *  check-in — e.g. a first-half leave — so the day is never penalised. */
const LEAVE_STATUSES_COVERING_DAY = [
  LeaveWorkflowStatus.submitted,
  LeaveWorkflowStatus.pending_approval,
  LeaveWorkflowStatus.approved,
];

export type LateArrivalDay = {
  employeeId: number;
  /** The AttendanceRecord's own attendanceDate key (local midnight). */
  attendanceDate: Date;
};

export type LateArrivalEvaluationResult = {
  triggeredHalfDay: boolean;
  leaveRequestId: number | null;
};

/**
 * Everything evaluation needs from outside the transaction, loaded before it opens.
 * The transaction holds the employee-month advisory lock, so it must never need a
 * second pool connection: a lock holder waiting on the pool while every other
 * connection sits blocked on its lock would deadlock until the pool times out.
 */
export type LateArrivalEvaluationContext = {
  settings: LateArrivalPolicySettingsRow;
  /** The employee's assigned shift; null means lateness can't be judged. */
  shift: ShiftSummary | null;
  schedule: WeeklySchedule;
};

const NOT_TRIGGERED: LateArrivalEvaluationResult = { triggeredHalfDay: false, leaveRequestId: null };

/**
 * Calendar month the free-lates counter resets on, e.g. "2026-09". Read from the
 * date's local components — the same components attendanceDate was built from
 * (see getISTDateParts), so this holds regardless of the process timezone.
 */
export function lateArrivalMonthKey(attendanceDate: Date): string {
  const month = String(attendanceDate.getMonth() + 1).padStart(2, "0");
  return `${attendanceDate.getFullYear()}-${month}`;
}

/**
 * Evaluation starts the day after the policy is switched on. A late arrival that
 * happened before the rule existed — including earlier on the day it was enabled —
 * is never penalised, and enabling never rewrites past attendance or leave.
 */
export function isAfterPolicyStart(attendanceDate: Date, enabledAt: Date): boolean {
  return startOfDay(attendanceDate).getTime() > startOfDay(enabledAt).getTime();
}

/** The Nth late arrival in a month costs a half-day once the free allowance is used up. */
export function isHalfDayOccurrence(occurrenceInMonth: number, freeLatesPerMonth: number): boolean {
  return occurrenceInMonth > freeLatesPerMonth;
}

export function buildAutoHalfDayReason(params: {
  checkIn: string;
  shift: Pick<ShiftSummary, "startTime" | "graceMinutes">;
  occurrenceInMonth: number;
  freeLatesAllowed: number;
}): string {
  const { checkIn, shift, occurrenceInMonth, freeLatesAllowed } = params;
  return (
    `Auto-applied: late arrival at ${checkIn} (shift starts ${shift.startTime}, ` +
    `${shift.graceMinutes} min grace). Late arrival #${occurrenceInMonth} this month; ` +
    `${freeLatesAllowed} allowed free. Contest via Attendance Regularization.`
  );
}

async function isNonWorkingDay(
  tx: Tx,
  attendanceDate: Date,
  schedule: WeeklySchedule
): Promise<boolean> {
  const holiday = await tx.holiday.findUnique({
    where: { holidayDate: attendanceDate },
    select: { id: true },
  });
  const override = await tx.attendanceDateOverride.findUnique({
    where: { date: attendanceDate },
    select: { type: true },
  });
  // Same precedence as regularization eligibility: a holiday stands unless the
  // date is explicitly overridden back to a working day.
  if (holiday && override?.type !== "working_day") return true;
  return resolveEffectiveScheduleType(attendanceDate, schedule, override?.type ?? null) === "weekly_off";
}

async function hasLeaveCoveringDay(tx: Tx, employeeId: number, attendanceDate: Date): Promise<boolean> {
  const leave = await tx.leaveRequest.findFirst({
    where: {
      employeeId,
      workflowStatus: { in: LEAVE_STATUSES_COVERING_DAY },
      startDate: { lte: attendanceDate },
      endDate: { gte: attendanceDate },
    },
    select: { id: true },
  });
  return leave !== null;
}

/**
 * Evaluates one day's attendance under the policy and, once the employee's
 * free-lates allowance for the month is used up, auto-applies a 0.5-day leave.
 *
 * Idempotent — guarded by LateArrivalPenalty's unique(employeeId, attendanceDate) —
 * and serialized per employee-month by an advisory lock, so days of the same
 * employee evaluated concurrently can never both claim the same occurrence number.
 * Skips regularized days, holidays/weekly offs, and days with leave already on them.
 *
 * Every query here goes through `tx` (see LateArrivalEvaluationContext). Pending
 * leave accruals must already be posted — evaluateLateArrivalsForDays does that
 * before opening the transaction.
 */
export async function evaluateLateArrivalForDay(
  tx: Tx,
  day: LateArrivalDay,
  context: LateArrivalEvaluationContext
): Promise<LateArrivalEvaluationResult> {
  const { employeeId, attendanceDate } = day;
  const { settings, shift, schedule } = context;

  if (!settings.enabled || !settings.enabledAt) return NOT_TRIGGERED;
  if (!isAfterPolicyStart(attendanceDate, settings.enabledAt)) return NOT_TRIGGERED;

  const record = await tx.attendanceRecord.findUnique({
    where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    select: { checkIn: true, activeRegularizationId: true },
  });
  // A regularized day's check-in is an HR correction, not the raw punch.
  if (!record?.checkIn || record.activeRegularizationId) return NOT_TRIGGERED;
  if (!shift || !isLateCheckIn(record.checkIn, shift)) return NOT_TRIGGERED;

  const monthKey = lateArrivalMonthKey(attendanceDate);
  const lockKey = `late_arrival_${employeeId}_${monthKey}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const alreadyEvaluated = await tx.lateArrivalPenalty.findUnique({
    where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    select: { id: true },
  });
  if (alreadyEvaluated) return NOT_TRIGGERED;

  if (await isNonWorkingDay(tx, attendanceDate, schedule)) return NOT_TRIGGERED;
  if (await hasLeaveCoveringDay(tx, employeeId, attendanceDate)) return NOT_TRIGGERED;

  // Reversed occurrences (contested and regularized) no longer use up the allowance.
  const priorThisMonth = await tx.lateArrivalPenalty.count({
    where: { employeeId, monthKey, reversedAt: null },
  });
  const occurrenceInMonth = priorThisMonth + 1;
  const triggeredHalfDay = isHalfDayOccurrence(occurrenceInMonth, settings.freeLatesPerMonth);

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
    reason: buildAutoHalfDayReason({
      checkIn: record.checkIn,
      shift,
      occurrenceInMonth,
      freeLatesAllowed: settings.freeLatesPerMonth,
    }),
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
        checkIn: record.checkIn,
        shiftStart: shift.startTime,
        graceMinutes: shift.graceMinutes,
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
 * request — same terminal fields, same balance-deduction call — so it reads and
 * reports identically to any other leave everywhere else in the app. Falls back
 * to loss of pay if the CL balance can't cover it.
 */
async function applyAutoHalfDayLeave(
  tx: Tx,
  params: { employeeId: number; attendanceDate: Date; reason: string }
): Promise<number> {
  const { employeeId, attendanceDate, reason } = params;

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
      reason,
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
      // Balance moved between the read above and the conditional decrement (a
      // concurrent manual approval). The decrement is an updateMany guarded on the
      // balance, so this is a plain thrown error and the transaction is still
      // usable — fall back to full LOP rather than failing the evaluation.
      lopDays = HALF_DAY;
      await tx.leaveRequest.update({ where: { id: leave.id }, data: { lopDays } });
    }
  }

  return leave.id;
}

/**
 * Evaluates many days — oldest first per employee, each in its own short
 * transaction — and never throws: attendance ingestion must not fail because of
 * the policy. Chronological order matters because the free allowance is used up
 * by the earliest late arrivals in the month, so the half-day lands on later ones.
 *
 * Only days that are actually late against the employee's shift open a
 * transaction; everything else is filtered out with two bulk reads up front.
 */
export async function evaluateLateArrivalsForDays(
  days: LateArrivalDay[]
): Promise<{ evaluated: number; halfDaysApplied: number; failed: number }> {
  const summary = { evaluated: 0, halfDaysApplied: 0, failed: 0 };
  if (days.length === 0) return summary;

  let settings: LateArrivalPolicySettingsRow;
  try {
    settings = await getLateArrivalPolicySettings();
  } catch (error) {
    logger.error("late_arrival.settings_read_failed", { message: String(error) });
    return summary;
  }
  const { enabledAt } = settings;
  if (!settings.enabled || !enabledAt) return summary;

  const inScope = days.filter((d) => isAfterPolicyStart(d.attendanceDate, enabledAt));
  if (inScope.length === 0) return summary;

  let candidates: LateCandidate[];
  let schedule: WeeklySchedule;
  try {
    [candidates, schedule] = await Promise.all([findLateCandidates(inScope), getAttendanceSettings()]);
  } catch (error) {
    logger.error("late_arrival.candidate_scan_failed", { message: String(error) });
    return summary;
  }

  for (const { shift, ...day } of candidates) {
    try {
      // Posts any pending CL/EL/SL accruals first (own transactions) so a half-day
      // is charged against the balance the employee is actually entitled to.
      await processPendingLeaveAccruals(day.employeeId);
      const result = await prisma.$transaction(
        (tx) => evaluateLateArrivalForDay(tx, day, { settings, shift, schedule }),
        { maxWait: 10_000, timeout: 30_000 }
      );
      summary.evaluated += 1;
      if (result.triggeredHalfDay) summary.halfDaysApplied += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("late_arrival.evaluation_failed", {
        employeeId: String(day.employeeId),
        attendanceDate: day.attendanceDate.toISOString(),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

type LateCandidate = LateArrivalDay & { shift: ShiftSummary };

async function findLateCandidates(days: LateArrivalDay[]): Promise<LateCandidate[]> {
  const wanted = new Set(days.map((d) => `${d.employeeId}|${d.attendanceDate.getTime()}`));
  const employeeIds = [...new Set(days.map((d) => d.employeeId))];
  const dates = [...new Map(days.map((d) => [d.attendanceDate.getTime(), d.attendanceDate])).values()];

  const [records, employees, shiftMap] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        attendanceDate: { in: dates },
        checkIn: { not: null },
        activeRegularizationId: null,
      },
      select: { employeeId: true, attendanceDate: true, checkIn: true },
    }),
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, shift: true },
    }),
    getShiftMap(),
  ]);

  const shiftByEmployee = new Map(
    employees.map((e) => [e.id, e.shift ? shiftMap.get(e.shift) ?? null : null])
  );

  const candidates: LateCandidate[] = [];
  for (const r of records) {
    if (!wanted.has(`${r.employeeId}|${r.attendanceDate.getTime()}`)) continue;
    const shift = shiftByEmployee.get(r.employeeId) ?? null;
    if (!shift || !isLateCheckIn(r.checkIn, shift)) continue;
    candidates.push({ employeeId: r.employeeId, attendanceDate: r.attendanceDate, shift });
  }
  return candidates.sort(
    (a, b) => a.employeeId - b.employeeId || a.attendanceDate.getTime() - b.attendanceDate.getTime()
  );
}

/** Post-import hook: evaluates every day written by one attendance upload. Never throws. */
export async function evaluateLateArrivalsForUpload(uploadId: number): Promise<void> {
  try {
    const rows = await prisma.attendanceRecord.findMany({
      where: { uploadId, checkIn: { not: null } },
      select: { employeeId: true, attendanceDate: true },
    });
    const summary = await evaluateLateArrivalsForDays(rows);
    if (summary.evaluated > 0 || summary.failed > 0) {
      logger.info("late_arrival.upload_evaluated", { uploadId: String(uploadId), ...summary });
    }
  } catch (error) {
    logger.error("late_arrival.upload_evaluation_failed", {
      uploadId: String(uploadId),
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The auto half-day leave the policy created for this employee's date, if any.
 * Regularization eligibility uses this so that the policy's own leave never
 * blocks the employee from contesting the late arrival it penalised.
 */
export async function findLateArrivalAutoLeaveId(
  employeeId: number,
  attendanceDate: Date
): Promise<number | null> {
  const penalty = await prisma.lateArrivalPenalty.findUnique({
    where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    select: { leaveRequestId: true, reversedAt: true },
  });
  if (!penalty || penalty.reversedAt) return null;
  return penalty.leaveRequestId;
}

/**
 * Reverses a late arrival once HR approves an Attendance Regularization for the
 * same date — the employee's contest path. An auto half-day is cancelled through
 * the normal HR cancellation workflow (balance refunded, employee emailed); a free
 * late is just marked reversed so it stops using up the monthly allowance.
 *
 * Called after approveRegularizationRequest's own transaction has committed
 * (cancelWorkflow opens its own transaction), so it is deliberately best-effort:
 * a failure here never surfaces as a failed regularization approval — it is
 * logged and leaves the penalty row unreversed for manual reconciliation.
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
    if (!penalty || penalty.reversedAt) return;

    if (penalty.triggeredHalfDay && penalty.leaveRequestId) {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id: penalty.leaveRequestId },
        select: { workflowStatus: true },
      });
      // HR may already have cancelled it by hand — nothing left to refund then.
      if (leave?.workflowStatus === LeaveWorkflowStatus.approved) {
        await cancelWorkflow(
          penalty.leaveRequestId,
          actor,
          `Reversed: attendance regularization #${regularizationRequestId} approved for this date.`
        );
      }
    }

    await prisma.lateArrivalPenalty.update({
      where: { id: penalty.id },
      data: { reversedAt: new Date(), reversedByRegularizationId: regularizationRequestId },
    });

    if (penalty.triggeredHalfDay && penalty.leaveRequestId) {
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
    }
  } catch (error) {
    logger.error("late_arrival.reversal_failed", {
      employeeId: String(employeeId),
      attendanceDate: attendanceDate.toISOString(),
      regularizationRequestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
