import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatLeaveDays } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";

type Leave = {
  id: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: string;
  createdAt: Date;
};

export function EmployeeLeaveTable({ leaves }: { leaves: Leave[] }) {
  return (
    <DataTable columns={["Type", "From", "To", "Days", "Reason", "Status", "Submitted"]}>
      {leaves.map((leave) => (
        <DataTableRow key={leave.id}>
          <DataTableCell>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">{leave.leaveType}</span>
          </DataTableCell>
          <DataTableCell>{formatDate(leave.startDate)}</DataTableCell>
          <DataTableCell>{formatDate(leave.endDate)}</DataTableCell>
          <DataTableCell className="tabular-nums">{formatLeaveDays(leave.days)}</DataTableCell>
          <DataTableCell>{leave.reason}</DataTableCell>
          <DataTableCell>
            <StatusBadge status={leave.status} />
          </DataTableCell>
          <DataTableCell className="text-muted-foreground">{formatDate(leave.createdAt)}</DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
