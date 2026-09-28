import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ShiftManagement } from "@/components/admin/shift-management";
import { LateArrivalPolicySettings } from "@/components/admin/late-arrival-policy-settings";
import { getSession } from "@/lib/auth";
import {
  getLateArrivalPolicyOverview,
  getLateArrivalPolicySettings,
} from "@/lib/attendance/late-arrival-policy-settings";
import { canManageAttendanceScheduling } from "@/lib/permissions";
import { getShifts } from "@/lib/shifts";
import { formatDate, startOfDay } from "@/lib/utils";

export default async function ShiftSettingsPage() {
  const session = await getSession();
  const canEdit = session ? canManageAttendanceScheduling(session.role) : false;
  const [shifts, lateArrivalSettings, lateArrivalOverview] = await Promise.all([
    getShifts(),
    getLateArrivalPolicySettings(),
    getLateArrivalPolicyOverview(),
  ]);

  // The policy evaluates attendance strictly after the day it was switched on.
  let effectiveFromLabel: string | null = null;
  if (lateArrivalSettings.enabled && lateArrivalSettings.enabledAt) {
    const effectiveFrom = startOfDay(lateArrivalSettings.enabledAt);
    effectiveFrom.setDate(effectiveFrom.getDate() + 1);
    effectiveFromLabel = formatDate(effectiveFrom);
  }

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Shift management"
        description="Define shift timings so HR can assign employees to the right shift."
      />
      <ShiftManagement shifts={shifts} canEdit={canEdit} />
      <LateArrivalPolicySettings
        enabled={lateArrivalSettings.enabled}
        freeLatesPerMonth={lateArrivalSettings.freeLatesPerMonth}
        effectiveFromLabel={effectiveFromLabel}
        overview={lateArrivalOverview}
        canEdit={canEdit}
      />
    </div>
  );
}
