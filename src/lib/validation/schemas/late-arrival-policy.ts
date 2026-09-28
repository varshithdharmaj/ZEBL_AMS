import { z } from "zod";

export const lateArrivalPolicyUpdateSchema = z.object({
  enabled: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
  freeLatesPerMonth: z.coerce
    .number()
    .int()
    .min(0, "Cannot be negative.")
    .max(10, "Must be 10 or fewer."),
});
