import { Suspense } from "react";
import Link from "next/link";
import { CalendarX2, ArrowRight } from "lucide-react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DashboardToolbar } from "@/components/employee/dashboard-toolbar";
import { formatDate, minutesToHours } from "@/lib/utils";

type Record = {
  id: number;
  attendanceDate: Date;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
};

export function HistorySection({
  monthLabel,
  records,
  defaultDate,
  defaultMonth,
}: {
  monthLabel: string;
  records: Record[];
  defaultDate: string;
  defaultMonth: string;
}) {
  return (
    <section className="employee-dashboard__history min-w-0">
      <header className="mb-4 flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="border-l-[3px] border-primary pl-4">
          <h2 className="text-lg font-semibold tracking-tight text-primary">Attendance history</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {monthLabel} · {records.length} record{records.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Suspense fallback={null}>
            <DashboardToolbar
              defaultDate={defaultDate}
              defaultMonth={defaultMonth}
              layout="inline"
            />
          </Suspense>
          <Button variant="outline" size="sm" asChild>
            <Link href="/employee/attendance">
              Full history
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {records.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No records this month"
          description="Try another month or check back after attendance is uploaded."
        />
      ) : (
        <DataTable
          columns={["Date", "Check in", "Check out", "Worked", "Overtime", "Status"]}
          className="w-full"
        >
          {records.map((r) => (
            <DataTableRow key={r.id}>
              <DataTableCell className="font-medium whitespace-nowrap">
                {formatDate(r.attendanceDate)}
              </DataTableCell>
              <DataTableCell className="tabular-nums">{r.checkIn ?? "—"}</DataTableCell>
              <DataTableCell className="tabular-nums">{r.checkOut ?? "—"}</DataTableCell>
              <DataTableCell className="tabular-nums">
                {minutesToHours(r.workedMinutes)}
              </DataTableCell>
              <DataTableCell className="tabular-nums">
                {minutesToHours(r.overtimeMinutes)}
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={r.status} />
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </section>
  );
}
