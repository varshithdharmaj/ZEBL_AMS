"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { lateArrivalPolicyUpdateSchema } from "@/lib/validation/schemas/late-arrival-policy";
import { ensureLateArrivalPolicySettingsRow } from "@/lib/attendance/late-arrival-policy-settings";

export type LateArrivalPolicyActionState = {
  error?: string;
  success?: string;
};

export async function updateLateArrivalPolicyAction(
  _prev: LateArrivalPolicyActionState,
  formData: FormData
): Promise<LateArrivalPolicyActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may manage the late arrival policy." };
  }

  const validated = safeParseWithSchema(lateArrivalPolicyUpdateSchema, {
    enabled: formData.get("enabled"),
    freeLatesPerMonth: formData.get("freeLatesPerMonth"),
  });
  if (!validated.ok) return { error: validated.error };

  const existing = await ensureLateArrivalPolicySettingsRow();
  const { enabled, freeLatesPerMonth } = validated.data;
  // Reset the cutoff every time the policy goes off -> on, so a gap in
  // enforcement never causes a retroactive catch-up once re-enabled.
  const turningOn = enabled && !existing.enabled;

  await prisma.lateArrivalPolicySettings.update({
    where: { id: existing.id },
    data: {
      enabled,
      freeLatesPerMonth,
      ...(turningOn ? { enabledAt: new Date() } : {}),
    },
  });

  await writeAuditLog({
    entityType: "late_arrival_policy_settings",
    entityId: existing.id,
    action: AUDIT_ACTIONS.LATE_ARRIVAL_POLICY_SETTINGS_UPDATED,
    actorUserId: session.id,
    actorEmail: session.email,
    oldValue: { enabled: existing.enabled, freeLatesPerMonth: existing.freeLatesPerMonth },
    newValue: { enabled, freeLatesPerMonth },
  });

  revalidatePath("/admin/shift-settings");
  return {
    success: enabled
      ? "Auto half-day on late arrival enabled."
      : "Auto half-day on late arrival disabled.",
  };
}
