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
