import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionCard } from "@/components/ui/section-card";
import { getAdminDashboardStats } from "@/lib/queries";
import { minutesToHours } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dashboard"
        description="Today's attendance overview and recent upload activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard label="Total employees" value={stats.totalEmployees} icon={Users} hint="Active workforce" />
        <DashboardCard label="Present today" value={stats.presentToday} icon={UserCheck} hint="On site" />
        <DashboardCard label="Absent today" value={stats.absentToday} icon={UserX} hint="No check-in" />
        <DashboardCard label="Short hours" value={stats.shortHoursToday} icon={Clock} hint="Below threshold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Recent uploads" contentClassName="p-0">
          {stats.recentUploads.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">No uploads yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.recentUploads.map((upload) => (
                <li
                  key={upload.id}
                  className="flex items-center justify-between gap-4 px-6 py-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{upload.fileName}</p>
                    <p className="text-muted-foreground">{upload.recordCount} records</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(upload.uploadedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div>
          <h2 className="mb-4 text-[0.9375rem] font-semibold text-foreground">Today&apos;s attendance</h2>
          <DataTable
            columns={["Employee", "In", "Out", "Hours", "Status"]}
            emptyMessage="No records today. Upload an Excel file to import."
          >
            {stats.todayRecords.map((record) => (
              <DataTableRow key={record.id}>
                <DataTableCell>
                  <p className="font-medium">{record.employee.name}</p>
                  <p className="text-xs text-muted-foreground">{record.employee.employeeCode}</p>
                </DataTableCell>
                <DataTableCell className="tabular-nums">{record.checkIn ?? "—"}</DataTableCell>
                <DataTableCell className="tabular-nums">{record.checkOut ?? "—"}</DataTableCell>
                <DataTableCell>{minutesToHours(record.workedMinutes)}</DataTableCell>
                <DataTableCell>
                  <StatusBadge status={record.status} />
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        </div>
      </div>
    </div>
  );
}
