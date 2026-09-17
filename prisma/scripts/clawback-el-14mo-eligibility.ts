/**
 * One-time data fix for the EL eligibility policy change (12 months -> 14
 * months from date of joining). Employees who were between 12 and 14 months
 * of tenure had already started accruing EL under the old rule; those lots
 * are no longer valid under the corrected policy and need to be removed.
 *
 * Constraint (by design, not by extra logic): a lot already consumed by an
 * approved leave request is never touched. This script only ever reads/writes
 * ElAccrualLot.remaining — it never inspects LeaveConsumption or LeaveRequest.
 * A fully-consumed lot already has remaining = 0 and is filtered out by the
 * query itself; a partially-consumed lot only loses what's still unused.
 *
 * Threshold per employee is computed with the exact same date-math the live
 * accrual engine uses (getElEligibilityDate + getFirstElAccrualDate from
 * src/lib/leave/el-dates.ts), so "should this lot exist" is judged
 * identically here and in production.
 *
 * Scope: ALL employees, active and inactive — a wrongly-granted lot
 * shouldn't linger just because someone already left (per policy decision).
 *
 * Reads the policy live from LeavePolicySettings rather than taking
 * elEligibilityMonths as a CLI arg, and refuses to run if it's still <= 12 —
 * run this AFTER saving elEligibilityMonths = 14 in /admin/leave-settings,
 * not before.
 *
 * Idempotent: re-running finds nothing to do for any lot already corrected
 * (remaining is already 0), so it's safe to re-run after a partial failure.
 * Follow up with `npx tsx prisma/scripts/check-el-invariant.ts` to confirm
 * elBalance === sum(remaining) still holds for every employee afterward.
 *
 * Usage: npx tsx prisma/scripts/clawback-el-14mo-eligibility.ts [--dry-run]
 */
import { PrismaClient } from "@/generated/prisma/client";
import { getElEligibilityDate, getFirstElAccrualDate } from "@/lib/leave/el-dates";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const policy = await prisma.leavePolicySettings.findUnique({ where: { id: 1 } });
  if (!policy) {
    throw new Error("LeavePolicySettings row (id=1) not found.");
  }
  if (policy.elEligibilityMonths <= 12) {
    throw new Error(
      `elEligibilityMonths is ${policy.elEligibilityMonths} (<= 12) — save the 14-month ` +
        `policy change in /admin/leave-settings before running this script.`
    );
  }

  const policyDates = {
    cycleStartDay: policy.cycleStartDay,
    elEligibilityMonths: policy.elEligibilityMonths,
    elExpiryMonths: policy.elExpiryMonths,
  };

  const employees = await prisma.employee.findMany({
    select: { id: true, joiningDate: true },
  });

  console.log(
    `Checking ${employees.length} employee(s) against eligibility = ${policy.elEligibilityMonths} months...`
  );

  let touchedEmployees = 0;
  let touchedLots = 0;
  let totalRemoved = 0;

  for (const employee of employees) {
    const eligibility = getElEligibilityDate(employee.joiningDate, policyDates);
    const threshold = getFirstElAccrualDate(eligibility, policyDates);

    const lots = await prisma.elAccrualLot.findMany({
      where: { employeeId: employee.id, accrualDate: { lt: threshold }, remaining: { gt: 0 } },
      orderBy: { accrualDate: "asc" },
    });
    if (lots.length === 0) continue;

    touchedEmployees += 1;

    for (const lot of lots) {
      const removable = lot.remaining;

      if (DRY_RUN) {
        console.log(
          `  [dry-run] employee ${employee.id}: lot ${lot.cycleKey} (accrued ${lot.accrualDate.toISOString().slice(0, 10)}, threshold ${threshold.toISOString().slice(0, 10)}) -> remove ${removable}`
        );
        touchedLots += 1;
        totalRemoved += removable;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const updated = await tx.elAccrualLot.updateMany({
          where: { id: lot.id, remaining: { gte: removable } },
          data: { remaining: { decrement: removable } },
        });
        if (updated.count === 0) return; // changed concurrently since the read above; skip, safe to re-run

        await tx.leaveTransaction.create({
          data: {
            employeeId: employee.id,
            leaveType: "EL",
            transactionType: "manual_adjustment",
            amount: -removable,
            reason: `EL eligibility policy correction (12mo -> ${policy.elEligibilityMonths}mo): lot ${lot.cycleKey} accrued ${lot.accrualDate.toISOString().slice(0, 10)} predates corrected eligibility (${threshold.toISOString().slice(0, 10)})`,
            createdBy: "system-migration",
            elAccrualLotId: lot.id,
          },
        });

        await tx.employeeLeaveBalance.update({
          where: { employeeId: employee.id },
          data: { elBalance: { decrement: removable } },
        });
      });

      touchedLots += 1;
      totalRemoved += removable;
      console.log(
        `  employee ${employee.id}: lot ${lot.cycleKey} remaining reduced by ${removable}`
      );
    }
  }

  console.log(
    `\n${DRY_RUN ? "[dry-run] Would touch" : "Touched"} ${touchedEmployees} employee(s), ${touchedLots} lot(s), total ${totalRemoved} day(s) removed.`
  );
  if (DRY_RUN) {
    console.log("--dry-run: no changes made. Re-run without --dry-run to apply.");
  } else if (touchedLots > 0) {
    console.log("Follow up with: npx tsx prisma/scripts/check-el-invariant.ts");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
