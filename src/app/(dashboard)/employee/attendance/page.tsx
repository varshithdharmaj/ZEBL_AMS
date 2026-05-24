import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getEmployeeAttendanceHistory } from "@/lib/queries";
import { formatDate, minutesToHours } from "@/lib/utils";

export default async function EmployeeAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const { page: pageStr } = await searchParams;
  const page = parseInt(pageStr ?? "1", 10) || 1;
  const { records, totalPages } = await getEmployeeAttendanceHistory(session.employeeId, page);

  return (
    <div className="space-y-8">
      <PageHeader title="Attendance history" description="Your complete attendance record." />

      <DataTable columns={["Date", "In", "Out", "Worked", "OT", "Status"]}>
        {records.map((record) => (
          <DataTableRow key={record.id}>
            <DataTableCell className="font-medium">{formatDate(record.attendanceDate)}</DataTableCell>
            <DataTableCell className="tabular-nums">{record.checkIn ?? "—"}</DataTableCell>
            <DataTableCell className="tabular-nums">{record.checkOut ?? "—"}</DataTableCell>
            <DataTableCell>{minutesToHours(record.workedMinutes)}</DataTableCell>
            <DataTableCell>{minutesToHours(record.overtimeMinutes)}</DataTableCell>
            <DataTableCell>
              <StatusBadge status={record.status} />
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/employee/attendance?page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/employee/attendance?page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
