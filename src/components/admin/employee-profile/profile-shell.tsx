"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppTabs, type TabDef } from "@/components/ui/app-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
  monthLabel: string;
  selectedMonth: string;
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
  defaultMonth,
}: {
  employee: ProfileEmployee;
  attendance: AttendanceSummary;
  balances: LeaveBalanceSummary[];
  history: HistoryRow[];
  defaultMonth: string;
}) {
  const [activeTab, setActiveTab] = useState("basic");

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
          <Link href="/admin/employees">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Employees
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 border-l-[3px] border-primary pl-4">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-primary">{employee.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[employee.employeeCode, employee.designation, employee.department]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <StatusBadge status={employee.employeeStatus} />
        </div>
      </div>

      <AppTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="pt-2">
        {activeTab === "basic" && <BasicInfoTab employee={employee} />}
        {activeTab === "attendance" && (
          <AttendanceTab summary={attendance} defaultMonth={defaultMonth} />
        )}
        {activeTab === "balances" && (
          <LeaveBalancesTab employeeId={employee.id} balances={balances} />
        )}
        {activeTab === "history" && <LeaveHistoryTab history={history} />}
      </div>
    </div>
  );
}
