"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addHistoricalLeaveAction,
  editHistoricalLeaveAction,
  type ActionState,
} from "@/actions/leave-history";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, formatLeaveDays } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";

type HistoryRow = {
  id: string;
  date: Date;
  leaveType: string;
  transactionType: string;
  amount: number;
  reason: string;
  updatedBy: string;
  importBatchId?: number | null;
  editableHistoricalEntry?: {
    leaveRequestId: number;
    startDate: Date;
    endDate: Date;
  } | null;
};

const initialState: ActionState = {};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function HistoricalEntryFields({
  leaveType,
  onLeaveTypeChange,
  defaultStartDate,
  defaultEndDate,
  defaultReason,
  pending,
}: {
  leaveType: string;
  onLeaveTypeChange: (value: string) => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultReason?: string;
  pending: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="leaveType" value={leaveType} />
      <div className="space-y-2">
        <Label>Leave type</Label>
        <Select value={leaveType} onValueChange={onLeaveTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAVE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t} — {LEAVE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div />
      <div className="space-y-2">
        <Label htmlFor="startDate">Start date</Label>
        <Input id="startDate" name="startDate" type="date" defaultValue={defaultStartDate} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endDate">End date</Label>
        <Input id="endDate" name="endDate" type="date" defaultValue={defaultEndDate} required disabled={pending} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          name="reason"
          defaultValue={defaultReason}
          required
          placeholder="e.g. Recorded from manual attendance register"
          disabled={pending}
        />
      </div>
    </div>
  );
}

export function LeaveHistoryTab({
  employeeId,
  history,
  canAddHistorical = false,
  canEditHistorical = false,
}: {
  employeeId?: number;
  history: HistoryRow[];
  canAddHistorical?: boolean;
  canEditHistorical?: boolean;
}) {
  const [addState, addAction, addPending] = useActionState(addHistoricalLeaveAction, initialState);
  const [editState, editAction, editPending] = useActionState(editHistoricalLeaveAction, initialState);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLeaveType, setAddLeaveType] = useState("CL");
  const [editingRow, setEditingRow] = useState<{
    leaveRequestId: number;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  } | null>(null);
  const [editLeaveType, setEditLeaveType] = useState("CL");

  useEffect(() => {
    if (addState.success) setShowAddForm(false);
  }, [addState.success]);

  useEffect(() => {
    if (editState.success) setEditingRow(null);
  }, [editState.success]);

  const showEditColumn = canEditHistorical && history.some((row) => row.editableHistoricalEntry);

  return (
    <div className="space-y-6">
      {canAddHistorical && employeeId != null && (
        <SectionCard
          title="Add historical leave"
          description="Records leave that was actually taken before migrating to this system — with its real dates, so it shows up correctly in the calendar and attendance reports."
        >
          {!showAddForm ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              Add historical leave
            </Button>
          ) : (
            <form action={addAction} className="max-w-lg space-y-4">
              <input type="hidden" name="employeeId" value={employeeId} />
              {addState.error && <ErrorAlert message={addState.error} />}
              {addState.success && (
                <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
                  {addState.success}
                </p>
              )}
              <HistoricalEntryFields
                leaveType={addLeaveType}
                onLeaveTypeChange={setAddLeaveType}
                pending={addPending}
              />
              <div className="flex gap-2">
                <Button type="submit" loading={addPending}>
                  {addPending ? "Adding…" : "Add entry"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} disabled={addPending}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SectionCard>
      )}

      {editingRow && employeeId != null && (
        <SectionCard
          title="Correct historical leave entry"
          description="The original entry is reversed and kept on record; this creates a corrected entry in its place."
        >
          <form action={editAction} className="max-w-lg space-y-4">
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="leaveRequestId" value={editingRow.leaveRequestId} />
            {editState.error && <ErrorAlert message={editState.error} />}
            <HistoricalEntryFields
              leaveType={editLeaveType}
              onLeaveTypeChange={setEditLeaveType}
              defaultStartDate={toDateInputValue(editingRow.startDate)}
              defaultEndDate={toDateInputValue(editingRow.endDate)}
              defaultReason={editingRow.reason}
              pending={editPending}
            />
            <div className="flex gap-2">
              <Button type="submit" loading={editPending}>
                {editPending ? "Saving…" : "Save correction"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingRow(null)} disabled={editPending}>
                Cancel
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <DataTable
        columns={
          showEditColumn
            ? ["Date", "Type", "Transaction", "Amount", "Reason", "By", "Actions"]
            : ["Date", "Type", "Transaction", "Amount", "Reason", "By"]
        }
        emptyMessage="No leave transactions."
      >
        {history.map((row) => (
          <DataTableRow key={row.id}>
            <DataTableCell>{formatDate(row.date)}</DataTableCell>
            <DataTableCell>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">{row.leaveType}</span>
            </DataTableCell>
            <DataTableCell className="text-muted-foreground">
              {formatType(row.transactionType)}
              {row.importBatchId != null && (
                <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  Batch #{row.importBatchId}
                </span>
              )}
              {row.editableHistoricalEntry && (
                <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-amber-800 ring-1 ring-amber-600/20">
                  Historical
                </span>
              )}
            </DataTableCell>
            <DataTableCell
              className={
                row.amount < 0 ? "font-medium text-danger tabular-nums" : "font-medium text-success tabular-nums"
              }
            >
              {row.amount > 0 ? "+" : ""}
              {formatLeaveDays(row.amount)}
            </DataTableCell>
            <DataTableCell className="max-w-xs">{row.reason}</DataTableCell>
            <DataTableCell className="text-muted-foreground">{row.updatedBy}</DataTableCell>
            {showEditColumn && (
              <DataTableCell>
                {row.editableHistoricalEntry && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditLeaveType(row.leaveType);
                      setEditingRow({
                        leaveRequestId: row.editableHistoricalEntry!.leaveRequestId,
                        leaveType: row.leaveType,
                        startDate: row.editableHistoricalEntry!.startDate,
                        endDate: row.editableHistoricalEntry!.endDate,
                        reason: row.reason,
                      });
                    }}
                  >
                    Edit
                  </Button>
                )}
              </DataTableCell>
            )}
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}
