import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { getShiftMap, shiftSpanMinutes } from "@/lib/attendance/shift-lookup";
import type { PayrollSettingsSnapshot } from "@/lib/payroll/payroll-types";

export type { PayrollSettingsSnapshot, PayrollShiftRule } from "@/lib/payroll/payroll-types";
export { resolveShiftPayrollRules } from "@/lib/payroll/payroll-types";

const DEFAULT_ID = "default";

export const getPayrollSettings = cache(async (): Promise<PayrollSettingsSnapshot> => {
  const [row, shiftMap] = await Promise.all([ensurePayrollSettingsRow(), getShiftMap()]);

  // Per-shift office presence comes from Shift Settings timings, so a shift's hours
  // are defined in one place. Employees with no (or an unrecognised) shift get the defaults.
  const shiftRules: PayrollSettingsSnapshot["shiftRules"] = {};
  for (const [name, shift] of shiftMap) {
    const span = shiftSpanMinutes(shift);
    if (span) shiftRules[name] = { requiredOfficeMinutes: span };
  }

  return {
    payrollStartDay: row.payrollStartDay,
    requiredWorkMinutes: row.requiredWorkMinutes,
    breakMinutes: row.breakMinutes,
    requiredOfficeMinutes: row.requiredOfficeMinutes,
    otThresholdMinutes: row.otThresholdMinutes,
    halfDayThresholdMinutes: row.halfDayThresholdMinutes,
    graceMinutes: row.graceMinutes,
    shiftRules,
  };
});

function assertPayrollSettingsClient() {
  if (!prisma.payrollSettings) {
    throw new Error(
      "Prisma client is missing payroll models. Stop the dev server, run: npx prisma generate && npx prisma migrate deploy, then restart npm run dev."
    );
  }
}

async function ensurePayrollSettingsRow() {
  assertPayrollSettingsClient();
  const existing = await prisma.payrollSettings.findUnique({ where: { id: DEFAULT_ID } });
  if (existing) return existing;

  try {
    return await prisma.payrollSettings.create({ data: { id: DEFAULT_ID } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return prisma.payrollSettings.findUniqueOrThrow({ where: { id: DEFAULT_ID } });
    }
    throw error;
  }
}
