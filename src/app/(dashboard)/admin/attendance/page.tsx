import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { AttendanceFilters } from "@/components/admin/attendance-filters";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getAttendanceRecords } from "@/lib/queries";
import { formatDate, minutesToHours } from "@/lib/utils";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10) || 1;
  const { records, total, totalPages } = await getAttendanceRecords({
    search: params.q,
    date: params.date,
    page,
  });

  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.date) query.set("date", params.date);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Attendance"
        description={`${total} record${total === 1 ? "" : "s"}`}
      />

      <AttendanceFilters defaultSearch={params.q} defaultDate={params.date} />

      <DataTable columns={["Date", "Employee", "In", "Out", "Worked", "OT", "Status"]}>
        {records.map((record) => (
          <DataTableRow key={record.id}>
            <DataTableCell>{formatDate(record.attendanceDate)}</DataTableCell>
            <DataTableCell>
              <p className="font-medium">{record.employee.name}</p>
              <p className="text-xs text-muted-foreground">{record.employee.employeeCode}</p>
            </DataTableCell>
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
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/attendance?${query.toString()}&page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          <span className="flex items-center text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/attendance?${query.toString()}&page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
