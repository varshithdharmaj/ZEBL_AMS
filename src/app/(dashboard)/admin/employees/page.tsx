import { PageHeader } from "@/components/ui/page-header";
import { EmployeeManagement } from "@/components/admin/employee-management";
import { getEmployees } from "@/lib/queries";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const employees = await getEmployees(q);

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee records, profiles, and access."
      />
      <EmployeeManagement employees={employees} />
    </div>
  );
}
