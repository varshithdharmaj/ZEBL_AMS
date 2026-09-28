import { z } from "zod";

export const payrollSettingsSchema = z.object({
  payrollStartDay: z.coerce
    .number()
    .int()
    .min(1, "Payroll start day must be between 1 and 28.")
    .max(28, "Payroll start day must be between 1 and 28."),
  requiredWorkMinutes: z.coerce
    .number()
    .int()
    .min(60, "Required work minutes must be between 60 and 720.")
    .max(720, "Required work minutes must be between 60 and 720."),
  breakMinutes: z.coerce
    .number()
    .int()
    .min(0, "Break minutes must be between 0 and 180.")
    .max(180, "Break minutes must be between 0 and 180."),
  requiredOfficeMinutes: z.coerce
    .number()
    .int()
    .min(60, "Required office minutes must be between 60 and 900.")
    .max(900, "Required office minutes must be between 60 and 900."),
  otThresholdMinutes: z.coerce
    .number()
    .int()
    .min(0, "Overtime threshold must be between 0 and 240 minutes.")
    .max(240, "Overtime threshold must be between 0 and 240 minutes."),
  halfDayThresholdMinutes: z.coerce
    .number()
    .int()
    .min(30, "Half-day threshold must be between 30 and 480 minutes.")
    .max(480, "Half-day threshold must be between 30 and 480 minutes."),
  graceMinutes: z.coerce
    .number()
    .int()
    .min(0, "Grace minutes must be between 0 and 120.")
    .max(120, "Grace minutes must be between 0 and 120."),
  shiftRulesJson: z.string().optional(),
});

export const payrollHrDecisionSchema = z.object({
  summaryId: z.coerce.number().int().positive(),
  hrDecision: z.enum([
    "no_action",
    "apply_leave",
    "salary_deduction",
    "warning",
    "approved_exception",
  ]),
  remarks: z.string().max(2000).optional(),
});
