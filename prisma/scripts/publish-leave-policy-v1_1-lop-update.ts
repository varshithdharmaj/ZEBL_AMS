/**
 * Publishes Leave Policy Document v1.1: updates only the "Loss of Pay (LOP)"
 * section (and the one sentence in "Monthly Leave Limit" that referenced the
 * old behavior) to describe the new auto-LOP-on-balance-exhaustion behavior
 * shipped alongside this script. Everything else is unchanged from v1.0.
 *
 * Follows the existing versioning convention: never edit a prior version in
 * place — deactivate it (isActive: false, effectiveTo: now) and create a new
 * active one (effectiveFrom: now). Idempotent: does nothing if v1.1 already
 * exists.
 *
 * Usage: npx tsx prisma/scripts/publish-leave-policy-v1_1-lop-update.ts
 */
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

const CONTENT = `# Company Leave Policy

**Policy Version:** 1.1

## Leave Cycle

The leave cycle runs from the 26th of one month to the 25th of the next
(e.g. 26 Dec 2025 – 25 Jan 2026). Monthly leave accounting — such as the
monthly leave limit below — follows this cycle.

## Earned Leave (EL)

- Accrues at 0.5 day per month.
- Monthly accrual begins after the employee completes one year (12 months)
  from their date of joining. No EL is backdated for the waiting period.
- The first accrual lands on the first 26th on or after the one-year
  completion date.
- EL carries forward — unused EL remains available, subject to its expiry.
- Each monthly accrual is valid for 36 months from the date it was granted.
  Oldest EL is used first (FIFO), so unused EL naturally expires in the
  order it was earned.
- EL may be encashed at the time of relieving from the organization, up to
  a maximum of 30 paid days.

## Sick Leave (SL)

- 6 days per year.
- Unused SL does not carry forward — it lapses at the end of the annual
  period (1 Jan – 31 Dec) and does not roll into the next year.
- Sick Leave is independent of the EL one-year eligibility rule and does not
  use the EL 36-month expiry model.
- Sick Leave requests are exempt from the standard advance-notice
  requirement below, since illness is inherently unplanned — at minimum a
  verbal approval from the reporting manager is expected for emergencies.

## Casual Leave (CL)

- 12 days per year.
- New joiners' entitlement is pro-rated based on their date of joining.

## Monthly Leave Limit

- A maximum of 2 leave days may be availed, and approved, per leave cycle
  month under normal circumstances.
- A request that would exceed this limit is not accepted at submission —
  reduce the requested days or contact HR. This is a separate rule from Loss
  of Pay below.

## Consecutive Leave

- A maximum of 3 consecutive days of leave can be approved at a time.

## Advance Notice

- Leave requests must normally be submitted at least 1 week (7 days) in
  advance.
- Sick Leave is exempt from this requirement given its emergency nature.

## Loss of Pay (LOP)

If an employee applies for leave and does not have enough Earned, Casual, or
Sick Leave balance to cover all the days requested, the request is not
rejected. It goes through the normal approval workflow like any other leave
request, and the days beyond the available balance are automatically
recorded as Loss of Pay (LOP) on that same request — visible alongside the
approved leave in leave history, the approval record, and payroll.

This is separate from the Monthly Leave Limit above: exceeding the monthly
limit still blocks the request at submission rather than converting the
excess to LOP.

## Notes

- No leave will be permitted during an employee's notice period, except for
  very urgent requirements — in which case the notice period is extended by
  the number of days taken.
- A paid holiday falling within a leave period is counted as part of that
  leave, regardless of leave type.
`;

async function main() {
  const existing = await prisma.leavePolicyDocument.findFirst({
    where: { version: "1.1" },
  });
  if (existing) {
    console.log("v1.1 leave policy document already exists (id " + existing.id + "). Nothing to do.");
    return;
  }

  const effectiveFrom = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.leavePolicyDocument.updateMany({
      where: { isActive: true },
      data: { isActive: false, effectiveTo: effectiveFrom },
    });

    const doc = await tx.leavePolicyDocument.create({
      data: {
        version: "1.1",
        effectiveFrom,
        isActive: true,
        content: CONTENT,
      },
    });
    console.log("Created leave policy document v1.1, id", doc.id);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
