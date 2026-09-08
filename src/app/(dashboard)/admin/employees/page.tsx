import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { EmployeeManagement } from "@/components/admin/employee-management";
import { getEmployees } from "@/lib/data";
import { getActiveShifts } from "@/lib/shifts";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [employees, shifts] = await Promise.all([getEmployees(q), getActiveShifts()]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Employees"
        description={`Manage employee records, profiles, and access · ${employees.length} total`}
      />
      <EmployeeManagement employees={employees} shifts={shifts} />
    </div>
  );
}
