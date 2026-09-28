import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";

const DEFAULT_ID = "default";

export type LateArrivalPolicySettingsRow = Awaited<
  ReturnType<typeof prisma.lateArrivalPolicySettings.findUniqueOrThrow>
>;

export async function ensureLateArrivalPolicySettingsRow(): Promise<LateArrivalPolicySettingsRow> {
  const existing = await prisma.lateArrivalPolicySettings.findUnique({ where: { id: DEFAULT_ID } });
  if (existing) return existing;

  try {
    return await prisma.lateArrivalPolicySettings.create({ data: { id: DEFAULT_ID } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return prisma.lateArrivalPolicySettings.findUniqueOrThrow({ where: { id: DEFAULT_ID } });
    }
    throw error;
  }
}

/**
 * Lazily creates the singleton row on first read, mirroring the
 * getAttendanceSettings()/getPayrollSettings() convention. Request-memoized —
 * the evaluation engine and the settings page both read this without
 * duplicating the query within one request.
 */
export const getLateArrivalPolicySettings = cache(
  async (): Promise<LateArrivalPolicySettingsRow> => ensureLateArrivalPolicySettingsRow()
);

export type LateArrivalPolicyOverview = {
  /** e.g. "2026-09" — current calendar month the counters below cover. */
  monthKey: string;
  latesThisMonth: number;
  halfDaysThisMonth: number;
  reversedThisMonth: number;
  /** Active employees the policy cannot cover: no shift, or a shift name that no
   *  longer matches an active Shift (renamed/deactivated since assignment). */
  activeEmployeesWithoutShift: number;
};

export async function getLateArrivalPolicyOverview(
  asOf: Date = new Date()
): Promise<LateArrivalPolicyOverview> {
  const monthKey = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}`;

  const [latesThisMonth, halfDaysThisMonth, reversedThisMonth, activeShifts, activeEmployees] =
    await Promise.all([
      prisma.lateArrivalPenalty.count({ where: { monthKey, reversedAt: null } }),
      prisma.lateArrivalPenalty.count({
        where: { monthKey, reversedAt: null, triggeredHalfDay: true },
      }),
      prisma.lateArrivalPenalty.count({ where: { monthKey, reversedAt: { not: null } } }),
      prisma.shift.findMany({ where: { isActive: true }, select: { name: true } }),
      prisma.employee.findMany({ where: { isActive: true }, select: { shift: true } }),
    ]);

  const activeShiftNames = new Set(activeShifts.map((s) => s.name));
  const activeEmployeesWithoutShift = activeEmployees.filter(
    (e) => !e.shift || !activeShiftNames.has(e.shift)
  ).length;

  return {
    monthKey,
    latesThisMonth,
    halfDaysThisMonth,
    reversedThisMonth,
    activeEmployeesWithoutShift,
  };
}
