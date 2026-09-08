"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import {
  createShiftAction,
  updateShiftAction,
  toggleShiftActiveAction,
  type ShiftActionState,
} from "@/actions/shifts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { ErrorAlert } from "@/components/ui/error-alert";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ShiftSummary } from "@/lib/shifts";

const initialState: ShiftActionState = {};

export function ShiftManagement({
  shifts,
  canEdit,
}: {
  shifts: ShiftSummary[];
  canEdit: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftSummary | null>(null);

  return (
    <SectionCard noPadding>
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {shifts.length} shift{shifts.length === 1 ? "" : "s"} configured
        </p>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add shift
          </Button>
        )}
      </div>

      <DataTable
        columns={["Name", "Timing", "Grace period", "Expected hours", "Status", ""]}
      >
        {shifts.length === 0 ? (
          <DataTableRow>
            <DataTableCell colSpan={6} className="py-10 text-center text-muted-foreground">
              No shifts configured yet.
            </DataTableCell>
          </DataTableRow>
        ) : (
          shifts.map((shift) => (
            <DataTableRow key={shift.id}>
              <DataTableCell className="font-medium">{shift.name}</DataTableCell>
              <DataTableCell className="tabular-nums text-muted-foreground">
                {shift.startTime} – {shift.endTime}
              </DataTableCell>
              <DataTableCell className="text-muted-foreground">
                {shift.graceMinutes} min
              </DataTableCell>
              <DataTableCell className="text-muted-foreground">
                {(shift.expectedWorkMinutes / 60).toFixed(1)} hrs
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={shift.isActive ? "Active" : "Inactive"} />
              </DataTableCell>
              <DataTableCell>
                {canEdit && (
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(shift)}>
                      Edit
                    </Button>
                    <ToggleActiveButton shift={shift} />
                  </div>
                )}
              </DataTableCell>
            </DataTableRow>
          ))
        )}
      </DataTable>

      {canEdit && (
        <>
          <ShiftFormDialog
            key="create"
            open={createOpen}
            onOpenChange={setCreateOpen}
            action={createShiftAction}
            title="Add shift"
            description="Define a shift's timing so HR can assign employees to it."
          />
          <ShiftFormDialog
            key={editing?.id ?? "edit"}
            open={editing != null}
            onOpenChange={(open) => !open && setEditing(null)}
            action={updateShiftAction}
            title="Edit shift"
            description="Update this shift's timing."
            shift={editing ?? undefined}
          />
        </>
      )}
    </SectionCard>
  );
}

function ToggleActiveButton({ shift }: { shift: ShiftSummary }) {
  const [, formAction, pending] = useActionState(toggleShiftActiveAction, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={shift.id} />
      <input type="hidden" name="isActive" value={(!shift.isActive).toString()} />
      <Button variant="outline" size="sm" type="submit" loading={pending}>
        {shift.isActive ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}

function ShiftFormDialog({
  open,
  onOpenChange,
  action,
  title,
  description,
  shift,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: (prev: ShiftActionState, formData: FormData) => Promise<ShiftActionState>;
  title: string;
  description: string;
  shift?: ShiftSummary;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {shift && <input type="hidden" name="id" value={shift.id} />}
          {state.error && <ErrorAlert message={state.error} />}
          {state.success && (
            <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
              {state.success}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Shift name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={shift?.name}
              placeholder="e.g. Morning Shift"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start time</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={shift?.startTime}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End time</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue={shift?.endTime}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="graceMinutes">Grace period (min)</Label>
              <Input
                id="graceMinutes"
                name="graceMinutes"
                type="number"
                min={0}
                max={180}
                defaultValue={shift?.graceMinutes ?? 0}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedWorkMinutes">Expected work (min)</Label>
              <Input
                id="expectedWorkMinutes"
                name="expectedWorkMinutes"
                type="number"
                min={60}
                max={900}
                defaultValue={shift?.expectedWorkMinutes ?? 480}
                required
              />
            </div>
          </div>
          <Button type="submit" loading={pending} className="w-full">
            {pending ? "Saving…" : shift ? "Save changes" : "Create shift"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
