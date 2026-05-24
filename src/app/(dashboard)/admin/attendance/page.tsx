import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AttendanceFilters } from "@/components/admin/attendance-filters";
import { SectionCard } from "@/components/ui/section-card";
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

  function pageHref(nextPage: number) {
    const q = new URLSearchParams(query.toString());
    q.set("page", String(nextPage));
    return `/admin/attendance?${q.toString()}`;
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Attendance"
        description={`Search and review attendance records · ${total} total`}
        action={
          <div className="w-full rounded-xl border border-border bg-muted/40 p-4 lg:min-w-[20rem]">
            <Suspense fallback={null}>
              <AttendanceFilters defaultSearch={params.q} defaultDate={params.date} />
            </Suspense>
          </div>
        }
      />

      <SectionCard
        title="Records"
        description={`Page ${page} of ${totalPages}`}
        noPadding
      >
        <DataTable columns={["Date", "Employee", "In", "Out", "Worked", "OT", "Status"]}>
          {records.map((record) => (
            <DataTableRow key={record.id}>
              <DataTableCell className="whitespace-nowrap">{formatDate(record.attendanceDate)}</DataTableCell>
              <DataTableCell>
                <p className="font-medium">{record.employee.name}</p>
                <p className="text-xs text-muted-foreground">{record.employee.employeeCode}</p>
              </DataTableCell>
              <DataTableCell className="tabular-nums">{record.checkIn ?? "—"}</DataTableCell>
              <DataTableCell className="tabular-nums">{record.checkOut ?? "—"}</DataTableCell>
              <DataTableCell className="tabular-nums">{minutesToHours(record.workedMinutes)}</DataTableCell>
              <DataTableCell className="tabular-nums">{minutesToHours(record.overtimeMinutes)}</DataTableCell>
              <DataTableCell>
                <StatusBadge status={record.status} />
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>

        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
              )}
              {page < totalPages ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
