import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeaveBalanceImportForm } from "@/components/admin/leave-balance-import-form";

export default function LeaveBalanceImportPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Import opening balances"
        description="Migrate EL/CL/SL balances from Excel — sets each employee's balance to the value in the file."
        backHref="/admin/leaves"
        backLabel="Leaves"
      />
      <LeaveBalanceImportForm />
    </div>
  );
}
