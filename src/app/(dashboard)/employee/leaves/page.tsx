import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeaveRequestForm } from "@/components/employee/leave-request-form";
import { EmployeeLeaveTable } from "@/components/employee/leave-table";
import { LeaveBalanceGrid } from "@/components/leave/leave-balance-grid";
import { SectionCard } from "@/components/ui/section-card";
import { getSession } from "@/lib/auth";
import { getEmployeeLeavePageData } from "@/lib/queries";

export default async function EmployeeLeavesPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const { balances, leaves } = await getEmployeeLeavePageData(session.employeeId);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Leave"
        description="View your balances and submit new leave requests."
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Balances</h2>
        <LeaveBalanceGrid balances={balances} />
      </section>

      <LeaveRequestForm />

      <SectionCard title="Your requests" description={`${leaves.length} submitted`} noPadding>
        <EmployeeLeaveTable leaves={leaves} />
      </SectionCard>
    </div>
  );
}
