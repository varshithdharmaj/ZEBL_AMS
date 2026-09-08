/**
 * One-time backfill after the night-shift date-bucketing fix
 * (biometric-attendance-derivation.ts / shift-lookup.ts).
 *
 * For every employee currently assigned a midnight-crossing shift (Night/US Shift),
 * re-derives attendance for every calendar date that has any BiometricPunch history.
 * `deriveAttendanceForEmployeeDate` is self-healing/idempotent — re-running it under
 * the fixed shift-aware bucketing naturally merges a shift's evening check-in and
 * next-morning checkout back into one record, and deletes any now-empty orphan record
 * the old per-calendar-day logic left on the following date.
 *
 * Uses each employee's CURRENT shift assignment for all of their history — there is no
 * shift-effective-dating in this schema, so an employee who changed shifts mid-history
 * has their entire punch history re-bucketed under their present-day assignment.
 *
 * Run: npx tsx prisma/scripts/backfill-night-shift-attendance.ts
 */
import { PrismaClient } from "@/generated/prisma/client";
import {
  deriveAttendanceForAffectedGroups,
  getISTDateParts,
  type AffectedEmployeeDateGroup,
} from "@/lib/integrations/biometric-attendance-derivation";
import { shiftCrossesMidnight } from "@/lib/attendance/shift-lookup";

const prisma = new PrismaClient();

async function main() {
  const shifts = await prisma.shift.findMany();
  const crossingShiftNames = new Set(
    shifts.filter((s) => shiftCrossesMidnight(s)).map((s) => s.name)
  );

  if (crossingShiftNames.size === 0) {
    console.log("No midnight-crossing shifts configured. Nothing to backfill.");
    return;
  }
  console.log(`Midnight-crossing shifts: ${[...crossingShiftNames].join(", ")}`);

  const employees = await prisma.employee.findMany({
    where: { shift: { in: [...crossingShiftNames] } },
    select: { id: true, employeeCode: true, name: true, shift: true },
  });

  if (employees.length === 0) {
    console.log("No employees currently assigned a midnight-crossing shift. Nothing to backfill.");
    return;
  }
  console.log(`${employees.length} employee(s) to re-derive:`);
  for (const e of employees) console.log(`  #${e.id} ${e.employeeCode} ${e.name} (${e.shift})`);

  const employeeIds = employees.map((e) => e.id);
  const punches = await prisma.biometricPunch.findMany({
    where: { employeeId: { in: employeeIds } },
    select: { employeeId: true, punchedAt: true },
  });
  console.log(`\n${punches.length} historical punch(es) across these employees.`);

  const groupMap = new Map<string, AffectedEmployeeDateGroup>();
  for (const p of punches) {
    if (p.employeeId == null) continue;
    const parts = getISTDateParts(p.punchedAt);
    const key = `${p.employeeId}_${parts.dateString}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        employeeId: p.employeeId,
        attendanceDate: parts.attendanceDate,
        dateString: parts.dateString,
      });
    }
  }
  const groups = [...groupMap.values()];
  console.log(`Re-deriving ${groups.length} employee/date pair(s)...`);

  await deriveAttendanceForAffectedGroups(groups);

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
