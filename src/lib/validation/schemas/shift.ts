import { z } from "zod";

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use 24-hour HH:mm format.");

export const shiftCreateSchema = z.object({
  name: z.string().trim().min(1, "Shift name is required.").max(100),
  startTime: timeOfDay,
  endTime: timeOfDay,
  graceMinutes: z.coerce.number().int().min(0, "Grace period cannot be negative.").max(180),
  expectedWorkMinutes: z.coerce
    .number()
    .int()
    .min(60, "Expected work minutes must be between 60 and 900.")
    .max(900, "Expected work minutes must be between 60 and 900."),
});

export const shiftUpdateSchema = shiftCreateSchema.extend({
  id: z.coerce.number().int().positive(),
});

export const shiftToggleActiveSchema = z.object({
  id: z.coerce.number().int().positive(),
  isActive: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
});
