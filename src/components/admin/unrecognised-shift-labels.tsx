"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { reassignShiftLabelAction, type ShiftActionState } from "@/actions/shifts";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShiftSummary, UnrecognisedShiftLabel } from "@/lib/shifts";

const initialState: ShiftActionState = {};

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Pre-picks the obvious target ("NS" → Night Shift, "Morning" → Morning Shift); never guesses between two. */
function suggestShift(label: string, shifts: ShiftSummary[]): ShiftSummary | undefined {
  const key = normalise(label);
  if (!key) return undefined;
  const matches = shifts.filter((shift) => {
    const name = normalise(shift.name);
    const initials = shift.name
      .split(/\s+/)
      .map((word) => word[0]?.toLowerCase() ?? "")
      .join("");
    return name === key || name === `${key}shift` || initials === key;
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function employeesLabel(count: number): string {
  return `${count} employee${count === 1 ? "" : "s"}`;
}

export function UnrecognisedShiftLabels({
  labels,
  shifts,
}: {
  labels: UnrecognisedShiftLabel[];
  shifts: ShiftSummary[];
}) {
  const [state, formAction] = useActionState(reassignShiftLabelAction, initialState);
  const activeShifts = shifts.filter((shift) => shift.isActive);

  if (labels.length === 0 && !state.success) return null;

  return (
    <SectionCard
      title="Employees on unrecognised shifts"
      description="These shift names don't match any shift below, so attendance and payroll treat these employees as having no shift: no shift timings, late marks or night-shift handling. Move each group to the right shift."
      className="border-warning/40"
    >
      {labels.length > 0 ? (
        <ul className="divide-y divide-border">
          {labels.map((label) => (
            <LabelRow
              key={label.label}
              label={label}
              shifts={activeShifts}
              formAction={formAction}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Every employee is on a recognised shift now.</p>
      )}
      {state.success && <p className="mt-4 text-sm text-success">{state.success}</p>}
      {state.error && <p className="mt-4 text-sm text-danger">{state.error}</p>}
    </SectionCard>
  );
}

function LabelRow({
  label,
  shifts,
  formAction,
}: {
  label: UnrecognisedShiftLabel;
  shifts: ShiftSummary[];
  formAction: (formData: FormData) => void;
}) {
  const [shiftId, setShiftId] = useState(
    () => suggestShift(label.label, shifts)?.id.toString() ?? ""
  );

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">&ldquo;{label.label}&rdquo;</p>
        <p className="text-xs text-muted-foreground">{employeesLabel(label.employeeCount)}</p>
      </div>
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="label" value={label.label} />
        <input type="hidden" name="shiftId" value={shiftId} />
        <Select value={shiftId} onValueChange={setShiftId}>
          <SelectTrigger className="w-full sm:w-56" aria-label={`Shift for ${label.label}`}>
            <SelectValue placeholder="Choose shift" />
          </SelectTrigger>
          <SelectContent>
            {shifts.map((shift) => (
              <SelectItem key={shift.id} value={String(shift.id)}>
                {shift.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {shift.startTime} – {shift.endTime}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MoveButton disabled={!shiftId} count={label.employeeCount} />
      </form>
    </li>
  );
}

function MoveButton({ disabled, count }: { disabled: boolean; count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled} loading={pending}>
      Move {count}
    </Button>
  );
}
