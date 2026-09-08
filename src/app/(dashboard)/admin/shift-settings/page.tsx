import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ShiftManagement } from "@/components/admin/shift-management";
import { getSession } from "@/lib/auth";
import { canManageAttendanceScheduling } from "@/lib/permissions";
import { getShifts } from "@/lib/shifts";

export default async function ShiftSettingsPage() {
  const session = await getSession();
  const canEdit = session ? canManageAttendanceScheduling(session.role) : false;
  const shifts = await getShifts();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Shift management"
        description="Define shift timings so HR can assign employees to the right shift."
      />
      <ShiftManagement shifts={shifts} canEdit={canEdit} />
    </div>
  );
}
