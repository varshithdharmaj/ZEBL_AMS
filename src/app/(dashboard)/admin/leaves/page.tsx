import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeaveManagement } from "@/components/admin/leave-management";
import { getAdminLeaveBalancesOverview } from "@/actions/leave-balances";
import { getLeaveRequests } from "@/lib/queries";

export default async function AdminLeavesPage() {
  const [leaves, balanceRows] = await Promise.all([
    getLeaveRequests("admin"),
    getAdminLeaveBalancesOverview(),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Leave management"
        description="Review requests, approve or reject, and monitor employee balances."
      />
      <LeaveManagement leaves={leaves} balanceRows={balanceRows} />
    </div>
  );
}
