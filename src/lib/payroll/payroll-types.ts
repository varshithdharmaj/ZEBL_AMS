import type { PayrollHrDecision } from "@/generated/prisma/client";

/** What an employee's assigned shift (Shift Settings) overrides in the org-wide defaults. */
export type PayrollShiftRule = {
  /** The shift's start→end span. */
  requiredOfficeMinutes?: number;
};

export type PayrollSettingsSnapshot = {
  payrollStartDay: number;
  requiredWorkMinutes: number;
  breakMinutes: number;
  requiredOfficeMinutes: number;
  otThresholdMinutes: number;
  halfDayThresholdMinutes: number;
  graceMinutes: number;
  /** Keyed by active Shift name, which is what Employee.shift stores. */
  shiftRules: Record<string, PayrollShiftRule>;
};

export const PAYROLL_HR_DECISION_OPTIONS: {
  value: PayrollHrDecision;
  label: string;
}[] = [
  { value: "no_action", label: "No Action" },
  { value: "apply_leave", label: "Apply Leave" },
  { value: "salary_deduction", label: "Salary Deduction" },
  { value: "warning", label: "Warning" },
  { value: "approved_exception", label: "Approved Exception" },
];

export function resolveShiftPayrollRules(
  settings: PayrollSettingsSnapshot,
  employeeShift: string | null | undefined
): {
  requiredOfficeMinutes: number;
  requiredWorkMinutes: number;
  breakMinutes: number;
  graceMinutes: number;
  otThresholdMinutes: number;
} {
  const shiftKey = employeeShift?.trim();
  const override = shiftKey ? settings.shiftRules[shiftKey] : undefined;

  return {
    requiredOfficeMinutes: override?.requiredOfficeMinutes ?? settings.requiredOfficeMinutes,
    requiredWorkMinutes: settings.requiredWorkMinutes,
    breakMinutes: settings.breakMinutes,
    graceMinutes: settings.graceMinutes,
    otThresholdMinutes: settings.otThresholdMinutes,
  };
}
