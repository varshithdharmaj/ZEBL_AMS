import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Upload,
  ClipboardList,
  UserCog,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import { SectionCard } from "@/components/ui/section-card";
import { WidgetCard } from "@/components/ui/widget-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getAdminDashboardStats } from "@/lib/queries";
import { minutesToHours } from "@/lib/utils";

export async function AdminDashboardView() {
  const stats = await getAdminDashboardStats();

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const attendanceRate =
    stats.totalEmployees > 0
      ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
      : 0;

  return (
    <div className="hr-dashboard">
      <div className="hr-dashboard__main">
        <WorkspacePageHeader
          title="Admin dashboard"
          description="Today's workforce overview, attendance snapshot, and recent uploads."
          badge={
            <span className="inline-flex items-center rounded-full bg-primary-muted px-3 py-1 text-xs font-medium text-primary">
              {todayLabel}
            </span>
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href="/admin/upload">
                  <Upload className="h-4 w-4" />
                  Upload
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/attendance">
                  <ClipboardList className="h-4 w-4" />
                  Attendance
                </Link>
              </Button>
            </div>
          }
        />

        <StatsGrid>
          <DashboardCard
            label="Total employees"
            value={stats.totalEmployees}
            hint="Active workforce"
            icon={Users}
            accent="blue"
          />
          <DashboardCard
            label="Present today"
            value={stats.presentToday}
            hint="On site"
            icon={UserCheck}
            accent="green"
          />
          <DashboardCard
            label="Absent today"
            value={stats.absentToday}
            hint="No check-in"
            icon={UserX}
            accent="amber"
          />
          <DashboardCard
            label="Short hours"
            value={stats.shortHoursToday}
            hint="Below threshold"
            icon={Clock}
            accent="violet"
          />
        </StatsGrid>

        <div className="hr-dashboard__analytics">
          <SectionCard title="Today's attendance" description={`${stats.todayRecords.length} records`} noPadding>
            {stats.todayRecords.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No records today.{" "}
                  <Link href="/admin/upload" className="font-medium text-primary hover:underline">
                    Upload an Excel file
                  </Link>{" "}
                  to import.
                </p>
              </div>
            ) : (
              <DataTable columns={["Employee", "In", "Out", "Hours", "Status"]}>
                {stats.todayRecords.map((record) => (
                  <DataTableRow key={record.id}>
                    <DataTableCell>
                      <p className="font-medium">{record.employee.name}</p>
                      <p className="text-xs text-muted-foreground">{record.employee.employeeCode}</p>
                    </DataTableCell>
                    <DataTableCell className="tabular-nums">{record.checkIn ?? "—"}</DataTableCell>
                    <DataTableCell className="tabular-nums">{record.checkOut ?? "—"}</DataTableCell>
                    <DataTableCell className="tabular-nums">
                      {minutesToHours(record.workedMinutes)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge status={record.status} />
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTable>
            )}
          </SectionCard>

          <SectionCard title="Recent uploads" description="Latest imports" contentClassName="p-0">
            {stats.recentUploads.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">No uploads yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.recentUploads.map((upload) => (
                  <li
                    key={upload.id}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-blue-muted text-accent-blue">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{upload.fileName}</p>
                      <p className="text-xs text-muted-foreground">{upload.recordCount} records</p>
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
            <div className="border-t border-border p-4">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/admin/upload">
                  Upload new file
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <aside className="hr-dashboard__rail">
        <WidgetCard title="Today at a glance" description="Live summary">
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Presence rate</span>
                <span className="font-semibold tabular-nums">{attendanceRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(attendanceRate, 100)}%` }}
                />
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-muted-foreground">Present</dt>
                <dd className="font-semibold tabular-nums text-accent-green">{stats.presentToday}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-muted-foreground">Absent</dt>
                <dd className="font-semibold tabular-nums text-foreground">{stats.absentToday}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-muted-foreground">Short hours</dt>
                <dd className="font-semibold tabular-nums text-accent-amber">{stats.shortHoursToday}</dd>
              </div>
            </dl>
          </div>
        </WidgetCard>

        <WidgetCard title="Quick actions" description="Common tasks">
          <ul className="space-y-2">
            {[
              { href: "/admin/upload", label: "Upload attendance", icon: Upload },
              { href: "/admin/employees", label: "Manage employees", icon: UserCog },
              { href: "/admin/leaves", label: "Leave management", icon: ClipboardList },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-card hover:shadow-subtle"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </WidgetCard>
      </aside>
    </div>
  );
}
