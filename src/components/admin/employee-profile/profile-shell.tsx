"use client";

import { useState } from "react";
import { AppTabs, type TabDef } from "@/components/ui/app-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { BasicInfoTab } from "@/components/admin/employee-profile/basic-info-tab";
import { AttendanceTab } from "@/components/admin/employee-profile/attendance-tab";
import { LeaveBalancesTab } from "@/components/admin/employee-profile/leave-balances-tab";
import { LeaveHistoryTab } from "@/components/admin/employee-profile/leave-history-tab";
import type { EmployeeStatus } from "@/lib/employee-types";
import type { LeaveBalanceSummary } from "@/lib/leave";

export type ProfileEmployee = {
  id: number;
  employeeCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  shift: string | null;
  joiningDate: Date;
  employeeStatus: EmployeeStatus;
  user: { email: string } | null;
};

type AttendanceSummary = {
  rangeLabel: string;
  selectedStart: string;
  selectedEnd: string;
  presentDays: number;
  shortHoursCount: number;
  overtimeMinutes: number;
  attendancePercent: number;
  lastAttendanceDate: Date | null;
  records: {
    id: number;
    attendanceDate: Date;
    checkIn: string | null;
    checkOut: string | null;
    workedMinutes: number;
    overtimeMinutes: number;
    status: string;
  }[];
};

type HistoryRow = {
  id: string;
  date: Date;
  leaveType: string;
  transactionType: string;
  amount: number;
  reason: string;
  updatedBy: string;
};

const TABS: TabDef[] = [
  { id: "basic", label: "Profile" },
  { id: "attendance", label: "Attendance" },
  { id: "balances", label: "Leave balances" },
  { id: "history", label: "Leave history" },
];

export function EmployeeProfileShell({
  employee,
  attendance,
  balances,
  history,
  defaultStart,
  defaultEnd,
}: {
  employee: ProfileEmployee;
  attendance: AttendanceSummary;
  balances: LeaveBalanceSummary[];
  history: HistoryRow[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const [activeTab, setActiveTab] = useState("basic");

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={employee.name}
        description={[employee.employeeCode, employee.designation, employee.department]
          .filter(Boolean)
          .join(" · ")}
        backHref="/admin/employees"
        backLabel="Employees"
        action={<StatusBadge status={employee.employeeStatus} />}
      />

      <AppTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="pt-2">
        {activeTab === "basic" && <BasicInfoTab employee={employee} />}
        {activeTab === "attendance" && (
          <AttendanceTab
            summary={attendance}
            defaultStart={defaultStart}
            defaultEnd={defaultEnd}
          />
        )}
        {activeTab === "balances" && (
          <LeaveBalancesTab employeeId={employee.id} balances={balances} />
        )}
        {activeTab === "history" && <LeaveHistoryTab history={history} />}
      </div>
    </div>
  );
}
