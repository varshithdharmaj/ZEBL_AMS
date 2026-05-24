import { DashboardHero } from "@/components/employee/dashboard/dashboard-hero";
import { DashboardKpiGrid } from "@/components/employee/dashboard/dashboard-kpi-grid";
import { HistorySection } from "@/components/employee/dashboard/history-section";
import { MonthlySummaryPanel } from "@/components/employee/dashboard/monthly-summary-panel";
import { AttendanceTimeline } from "@/components/employee/attendance-timeline";
import { getEmployeeDashboardData } from "@/lib/queries";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { startOfDay } from "@/lib/utils";

export async function EmployeeDashboard({
  employeeId,
  employeeName,
  selectedDate,
  selectedMonth,
}: {
  employeeId: number;
  employeeName: string | null;
  selectedDate?: string;
  selectedMonth?: string;
}) {
  const today = startOfDay().toISOString().split("T")[0];

  const [data, balances] = await Promise.all([
    getEmployeeDashboardData(employeeId, selectedDate, selectedMonth),
    getLeaveBalanceSummaries(employeeId, { processAccruals: false }),
  ]);

  const firstName = employeeName?.split(" ")[0] ?? "there";
  const displayDate = new Date(data.selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const selectedDayLabel = new Date(data.selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="employee-dashboard w-full">
      <DashboardHero
        firstName={firstName}
        fullName={employeeName}
        displayDate={displayDate}
        dateIso={data.selectedDate}
        status={data.day.status}
        workedMinutes={data.day.workedMinutes}
        presentDays={data.monthly.presentDays}
        monthLabel={data.monthly.monthLabel}
        defaultDate={today}
        defaultMonth={data.selectedMonth}
      />

      <DashboardKpiGrid
        workedMinutes={data.day.workedMinutes}
        presentDays={data.monthly.presentDays}
        overtimeMinutes={data.monthly.overtimeMinutes}
        shortHoursCount={data.monthly.shortHoursCount}
        monthLabel={data.monthly.monthLabel}
        balances={balances}
      />

      <section className="employee-dashboard__overview employee-dashboard-overview">
        <AttendanceTimeline
          checkIn={data.day.checkIn}
          checkOut={data.day.checkOut}
          workedMinutes={data.day.workedMinutes}
          overtimeMinutes={data.day.overtimeMinutes}
          status={data.day.status}
          selectedDateLabel={selectedDayLabel}
        />
        <MonthlySummaryPanel
          monthLabel={data.monthly.monthLabel}
          attendancePercent={data.monthly.attendancePercent}
          presentDays={data.monthly.presentDays}
          shortHoursCount={data.monthly.shortHoursCount}
          overtimeMinutes={data.monthly.overtimeMinutes}
          balances={balances}
        />
      </section>

      <HistorySection
        monthLabel={data.monthly.monthLabel}
        records={data.recentRecords}
        defaultDate={today}
        defaultMonth={data.selectedMonth}
      />
    </div>
  );
}
