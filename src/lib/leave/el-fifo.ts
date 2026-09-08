import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordLeaveTransactionInTx } from "@/lib/leave";
import { getOrCreateLeaveBalanceRow } from "@/lib/leave/balance-row";
import { getElExpiryDate } from "@/lib/leave/el-dates";
import { getLeavePolicySettings } from "@/lib/leave/leave-policy";

type TxClient = Prisma.TransactionClient;

/**
 * Consumes `days` of EL FIFO (oldest accrualDate first) across non-expired,
 * non-exhausted lots, recording one LeaveConsumption row per lot touched so
 * cancellation can restore the exact amount to the exact lot. The aggregate
 * ledger row / cached-balance decrement is delegated to the existing
 * recordLeaveTransactionInTx, which also enforces at-most-one-deduction-per-
 * leaveRequestId via its unique index.
 */
export async function consumeElFifo(
  tx: TxClient,
  params: {
    employeeId: number;
    days: number;
    leaveRequestId: number;
    createdBy: string;
    asOf?: Date;
  }
): Promise<void> {
  const { employeeId, days, leaveRequestId, createdBy, asOf = new Date() } = params;

  const lots = await tx.elAccrualLot.findMany({
    where: { employeeId, remaining: { gt: 0 }, expiryDate: { gt: asOf } },
    orderBy: { accrualDate: "asc" },
  });

  let remainingNeeded = days;
  const toConsume: { lotId: number; amount: number }[] = [];

  for (const lot of lots) {
    if (remainingNeeded <= 0) break;
    const take = Math.min(lot.remaining, remainingNeeded);
    if (take <= 0) continue;
    toConsume.push({ lotId: lot.id, amount: take });
    remainingNeeded -= take;
  }

  if (remainingNeeded > 0) {
    throw new Error(`Insufficient EL balance. Available balance is less than required: ${days}`);
  }

  for (const { lotId, amount } of toConsume) {
    const updated = await tx.elAccrualLot.updateMany({
      where: { id: lotId, remaining: { gte: amount } },
      data: { remaining: { decrement: amount } },
    });
    if (updated.count === 0) {
      throw new Error("EL lot balance changed concurrently — please retry.");
    }
    await tx.leaveConsumption.create({
      data: { leaveRequestId, elAccrualLotId: lotId, amount },
    });
  }

  await recordLeaveTransactionInTx(tx, {
    employeeId,
    leaveType: "EL",
    transactionType: "deduction",
    amount: days,
    reason: `Leave request #${leaveRequestId} approved`,
    createdBy,
    leaveRequestId,
  });
}

/**
 * Restores EL consumed by a cancelled/reversed approved leave request to the
 * exact lots it was originally taken from (per the recorded LeaveConsumption
 * rows), then writes the balance/ledger restore via the existing
 * restoreLeaveBalanceForCancellation path (its unique index already prevents
 * a leave request from being restored twice).
 */
export async function restoreElForCancellation(
  tx: TxClient,
  params: {
    employeeId: number;
    leaveRequestId: number;
    createdBy: string;
    reason: string;
  }
): Promise<void> {
  const { employeeId, leaveRequestId, createdBy, reason } = params;

  const consumptions = await tx.leaveConsumption.findMany({
    where: { leaveRequestId },
  });
  if (consumptions.length === 0) return;

  const total = consumptions.reduce((sum, c) => sum + c.amount, 0);

  for (const consumption of consumptions) {
    await tx.elAccrualLot.update({
      where: { id: consumption.elAccrualLotId },
      data: { remaining: { increment: consumption.amount } },
    });
  }

  await recordLeaveTransactionInTx(tx, {
    employeeId,
    leaveType: "EL",
    transactionType: "accrual",
    amount: total,
    reason: `Cancellation of leave #${leaveRequestId}: ${reason}`,
    createdBy,
    leaveRequestId,
  });
}

export async function hasElConsumptionRecord(leaveRequestId: number): Promise<boolean> {
  const count = await prisma.leaveConsumption.count({ where: { leaveRequestId } });
  return count > 0;
}

/**
 * HR manual EL adjustment. A positive adjustment creates a new lot (so it
 * expires 36 months out and participates in FIFO like any real accrual); a
 * negative adjustment consumes existing lots FIFO, same as leave usage,
 * so the elBalance cache never drifts from sum(remaining) across lots.
 * Not tied to a LeaveRequest, so no LeaveConsumption rows are written —
 * there's nothing to restore a manual adjustment "against".
 */
export async function adminAdjustElBalance(params: {
  employeeId: number;
  adjustment: number;
  reason: string;
  createdBy: string;
  /** Backdates the new lot + its expiry — used by the opening-balance importer
   *  so migrated EL reflects when it was actually earned, not "now". */
  accrualDate?: Date;
  transactionType?: "manual_adjustment" | "opening_balance";
  importBatchId?: number;
  tx?: TxClient;
}): Promise<void> {
  const {
    employeeId,
    adjustment,
    reason,
    createdBy,
    accrualDate: accrualDateParam,
    transactionType = "manual_adjustment",
    importBatchId,
    tx,
  } = params;
  if (adjustment === 0) {
    throw new Error("Adjustment amount cannot be zero.");
  }

  const run = async (tx: TxClient) => {
    await getOrCreateLeaveBalanceRow(employeeId, tx);

    if (adjustment > 0) {
      const policy = await getLeavePolicySettings();
      const accrualDate = accrualDateParam ?? new Date();
      // Not eligibility-gated: this operates directly on lots, so it's how
      // opening-balance imports intentionally bypass the 1-year EL rule.
      const lot = await tx.elAccrualLot.create({
        data: {
          employeeId,
          cycleKey: `manual-${employeeId}-${Date.now()}`,
          accrualDate,
          amount: adjustment,
          remaining: adjustment,
          expiryDate: getElExpiryDate(accrualDate, policy),
        },
      });
      await tx.leaveTransaction.create({
        data: {
          employeeId,
          leaveType: "EL",
          transactionType,
          amount: adjustment,
          reason,
          createdBy,
          elAccrualLotId: lot.id,
          importBatchId: importBatchId ?? null,
        },
      });
      await tx.employeeLeaveBalance.update({
        where: { employeeId },
        data: { elBalance: { increment: adjustment } },
      });
      return;
    }

    const abs = Math.abs(adjustment);
    const lots = await tx.elAccrualLot.findMany({
      where: { employeeId, remaining: { gt: 0 } },
      orderBy: { accrualDate: "asc" },
    });

    let remainingNeeded = abs;
    const toConsume: { lotId: number; amount: number }[] = [];
    for (const lot of lots) {
      if (remainingNeeded <= 0) break;
      const take = Math.min(lot.remaining, remainingNeeded);
      if (take <= 0) continue;
      toConsume.push({ lotId: lot.id, amount: take });
      remainingNeeded -= take;
    }
    if (remainingNeeded > 0) {
      throw new Error(
        `Insufficient EL balance for this adjustment. Short by ${remainingNeeded}.`
      );
    }

    for (const { lotId, amount } of toConsume) {
      const updated = await tx.elAccrualLot.updateMany({
        where: { id: lotId, remaining: { gte: amount } },
        data: { remaining: { decrement: amount } },
      });
      if (updated.count === 0) {
        throw new Error("EL lot balance changed concurrently — please retry.");
      }
    }

    await tx.leaveTransaction.create({
      data: {
        employeeId,
        leaveType: "EL",
        transactionType,
        amount: adjustment,
        reason,
        createdBy,
        importBatchId: importBatchId ?? null,
      },
    });
    await tx.employeeLeaveBalance.update({
      where: { employeeId },
      data: { elBalance: { decrement: abs } },
    });
  };

  if (tx) {
    await run(tx);
  } else {
    await prisma.$transaction(run);
  }
}

/**
 * "Set to" (absolute) EL balance edit, implemented as diff-then-delta on top
 * of adminAdjustElBalance. Used by both the per-employee HR correction form
 * (transactionType defaults to "manual_adjustment") and the bulk
 * opening-balance importer (transactionType: "opening_balance" + importBatchId
 * + an optional historical accrualDate). A zero delta is a no-op — this is
 * what makes re-running the same import idempotent.
 */
export async function adminSetElBalance(params: {
  employeeId: number;
  targetBalance: number;
  reason: string;
  createdBy: string;
  accrualDate?: Date;
  transactionType?: "manual_adjustment" | "opening_balance";
  importBatchId?: number;
  tx?: TxClient;
}): Promise<{ delta: number; skipped: boolean }> {
  const { employeeId, targetBalance, reason, createdBy, accrualDate, transactionType, importBatchId, tx } =
    params;

  const balance = await getOrCreateLeaveBalanceRow(employeeId, tx);
  const delta = targetBalance - balance.elBalance;
  if (delta === 0) {
    return { delta: 0, skipped: true };
  }

  await adminAdjustElBalance({
    employeeId,
    adjustment: delta,
    reason,
    createdBy,
    accrualDate,
    transactionType,
    importBatchId,
    tx,
  });

  return { delta, skipped: false };
}

/** Seeds an optional initial EL balance on employee creation as a real (lot-backed) accrual. */
export async function seedInitialElLot(
  employeeId: number,
  amount: number,
  createdBy = "system"
): Promise<void> {
  if (amount <= 0) return;
  await adminAdjustElBalance({
    employeeId,
    adjustment: amount,
    reason: "Initial balance on employee creation",
    createdBy,
  });
}
