import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveRequestForm } from "@/components/employee/leave-request-form";
import { EmployeeLeaveTable } from "@/components/employee/leave-table";
import { LeaveBalanceGrid } from "@/components/leave/leave-balance-grid";
import { getSession } from "@/lib/auth";
import { getEmployeeLeavePageData } from "@/lib/queries";

export default async function EmployeeLeavesPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const { balances, leaves } = await getEmployeeLeavePageData(session.employeeId);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Leave"
        description="View balances and submit leave requests."
      />

      <section className="space-y-4">
        <h2 className="text-[0.9375rem] font-semibold">Balances</h2>
        <LeaveBalanceGrid balances={balances} />
      </section>

      <LeaveRequestForm />

      <section className="space-y-4">
        <h2 className="text-[0.9375rem] font-semibold">Your requests</h2>
        <EmployeeLeaveTable leaves={leaves} />
      </section>
    </div>
  );
}
