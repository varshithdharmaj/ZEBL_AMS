"use client";

import { useState } from "react";
import { AppTabs, type TabDef } from "@/components/ui/app-tabs";
import { AdminLeaveTable } from "@/components/admin/leave-table";
import { LeaveBalanceManager } from "@/components/admin/leave-balance-manager";
import type { LeaveBalanceSummary } from "@/lib/leave";

type Leave = {
  id: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: string;
  createdAt: Date;
  employee: { name: string; employeeCode: string };
};

type BalanceRow = {
  employeeId: number;
  employeeCode: string;
  name: string;
  department: string | null;
  joiningDate: Date;
  balances: LeaveBalanceSummary[];
};

export function LeaveManagement({
  leaves,
  balanceRows,
}: {
  leaves: Leave[];
  balanceRows: BalanceRow[];
}) {
  const pending = leaves.filter((l) => l.status === "pending").length;
  const tabs: TabDef[] = [
    { id: "requests", label: "Requests", count: pending },
    { id: "balances", label: "Balances" },
  ];
  const [active, setActive] = useState("requests");

  return (
    <div className="space-y-6">
      <AppTabs tabs={tabs} active={active} onChange={setActive} />
      {active === "requests" && <AdminLeaveTable leaves={leaves} />}
      {active === "balances" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Open an employee profile to adjust balances. All changes are logged.
          </p>
          <LeaveBalanceManager rows={balanceRows} />
        </div>
      )}
    </div>
  );
}
