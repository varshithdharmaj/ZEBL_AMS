"use client";

import { reviewLeaveFormAction } from "@/actions/leaves";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPE_LABELS, formatLeaveDays, type LeaveType } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";

type Leave = {
  id: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: string;
  employee: { name: string; employeeCode: string };
};

export function AdminLeaveTable({ leaves }: { leaves: Leave[] }) {
  return (
    <DataTable columns={["Employee", "Type", "Dates", "Days", "Reason", "Status", ""]} emptyMessage="No requests.">
      {leaves.map((leave) => (
        <DataTableRow key={leave.id}>
          <DataTableCell>
            <p className="font-medium">{leave.employee.name}</p>
            <p className="text-xs text-muted-foreground">{leave.employee.employeeCode}</p>
          </DataTableCell>
          <DataTableCell>
            <p className="text-sm font-medium">{leave.leaveType}</p>
            <p className="text-xs text-muted-foreground">
              {LEAVE_TYPE_LABELS[leave.leaveType as LeaveType]}
            </p>
          </DataTableCell>
          <DataTableCell className="text-sm text-muted-foreground">
            {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
          </DataTableCell>
          <DataTableCell className="tabular-nums">{formatLeaveDays(leave.days)}</DataTableCell>
          <DataTableCell className="max-w-[200px] truncate">{leave.reason}</DataTableCell>
          <DataTableCell>
            <StatusBadge status={leave.status} />
          </DataTableCell>
          <DataTableCell>
            {leave.status === "pending" && (
              <div className="flex gap-1.5">
                <form action={reviewLeaveFormAction}>
                  <input type="hidden" name="leaveId" value={leave.id} />
                  <input type="hidden" name="status" value="approved" />
                  <Button type="submit" size="sm">
                    Approve
                  </Button>
                </form>
                <form action={reviewLeaveFormAction}>
                  <input type="hidden" name="leaveId" value={leave.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <Button type="submit" size="sm" variant="outline">
                    Reject
                  </Button>
                </form>
              </div>
            )}
          </DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
