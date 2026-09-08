import { z } from "zod";

const checkboxBoolean = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const leavePolicySettingsSchema = z
  .object({
    cycleStartDay: z.coerce
      .number()
      .int()
      .min(1, "Cycle start day must be between 1 and 28.")
      .max(28, "Cycle start day must be between 1 and 28."),
    elAccrualAmount: z.coerce
      .number()
      .positive("Monthly EL accrual must be greater than 0 and at most 31.")
      .max(31, "Monthly EL accrual must be greater than 0 and at most 31."),
    elEligibilityMonths: z.coerce
      .number()
      .int()
      .min(0, "EL eligibility period must be between 0 and 120 months.")
      .max(120, "EL eligibility period must be between 0 and 120 months."),
    elExpiryMonths: z.coerce
      .number()
      .int()
      .min(1, "EL expiry must be between 1 and 600 months.")
      .max(600, "EL expiry must be between 1 and 600 months."),
    elEncashmentCapDays: z.coerce
      .number()
      .min(0, "EL encashment cap must be between 0 and 365 days.")
      .max(365, "EL encashment cap must be between 0 and 365 days."),
    slAnnualEntitlement: z.coerce
      .number()
      .int()
      .min(0, "SL annual entitlement must be between 0 and 365 days.")
      .max(365, "SL annual entitlement must be between 0 and 365 days."),
    slCarryForward: checkboxBoolean,
    slExpiryMonths: z.coerce
      .number()
      .int()
      .min(1, "SL expiry must be between 1 and 600 months.")
      .max(600, "SL expiry must be between 1 and 600 months.")
      .optional()
      .nullable(),
    clAnnualEntitlement: z.coerce
      .number()
      .int()
      .min(0, "CL annual entitlement must be between 0 and 365 days.")
      .max(365, "CL annual entitlement must be between 0 and 365 days."),
    monthlyLeaveLimit: z.coerce
      .number()
      .min(0, "Monthly leave limit must be between 0 and 31 days.")
      .max(31, "Monthly leave limit must be between 0 and 31 days."),
    maxConsecutiveDays: z.coerce
      .number()
      .int()
      .min(1, "Maximum consecutive days must be between 1 and 365.")
      .max(365, "Maximum consecutive days must be between 1 and 365."),
    advanceNoticeDays: z.coerce
      .number()
      .int()
      .min(0, "Advance notice must be between 0 and 90 days.")
      .max(90, "Advance notice must be between 0 and 90 days."),
  })
  .transform((v) => ({
    ...v,
    // Expiry is only meaningful when carry-forward is enabled — otherwise SL
    // simply lapses at year end and there's nothing to expire.
    slExpiryMonths: v.slCarryForward ? (v.slExpiryMonths ?? null) : null,
  }));

export type LeavePolicySettingsInput = z.infer<typeof leavePolicySettingsSchema>;
