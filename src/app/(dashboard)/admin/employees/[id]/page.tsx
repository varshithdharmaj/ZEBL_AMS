import { notFound } from "next/navigation";
import { EmployeeProfileShell } from "@/components/admin/employee-profile/profile-shell";
import { getEmployeeProfileLeaveData } from "@/actions/leave-balances";
import { getEmployeeAttendanceSummary, getEmployeeById } from "@/lib/queries";
import { defaultDateRange } from "@/lib/utils";
import type { EmployeeStatus } from "@/lib/employee-types";

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: idStr } = await params;
  const { start, end } = await searchParams;
  const id = parseInt(idStr, 10);

  if (Number.isNaN(id)) notFound();

  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const { start: defaultStart, end: defaultEnd } = defaultDateRange();

  const [attendance, leaveData] = await Promise.all([
    getEmployeeAttendanceSummary(id, start, end),
    getEmployeeProfileLeaveData(id),
  ]);

  const profileEmployee = {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation,
    shift: employee.shift,
    joiningDate: employee.joiningDate,
    employeeStatus: employee.employeeStatus as EmployeeStatus,
    user: employee.user,
  };

  return (
    <EmployeeProfileShell
      employee={profileEmployee}
      attendance={attendance}
      balances={leaveData.balances}
      history={leaveData.history}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
    />
  );
}
