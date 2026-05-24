import { PageHeader } from "@/components/ui/page-header";
import { LeaveManagement } from "@/components/admin/leave-management";
import { getAdminLeaveBalancesOverview } from "@/actions/leave-balances";
import { getLeaveRequests } from "@/lib/queries";

export default async function AdminLeavesPage() {
  const [leaves, balanceRows] = await Promise.all([
    getLeaveRequests("admin"),
    getAdminLeaveBalancesOverview(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Leave" description="Review requests and monitor balances." />
      <LeaveManagement leaves={leaves} balanceRows={balanceRows} />
    </div>
  );
}
