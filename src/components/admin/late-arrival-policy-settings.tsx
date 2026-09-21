"use client";

import { useActionState, useState } from "react";
import {
  updateLateArrivalPolicyAction,
  type LateArrivalPolicyActionState,
} from "@/actions/late-arrival-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { StatusBadge } from "@/components/ui/status-badge";

const initialState: LateArrivalPolicyActionState = {};

export function LateArrivalPolicySettings({
  enabled,
  freeLatesPerMonth,
  canEdit,
}: {
  enabled: boolean;
  freeLatesPerMonth: number;
  canEdit: boolean;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    updateLateArrivalPolicyAction,
    initialState
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    updateLateArrivalPolicyAction,
    initialState
  );
  const [draftFreeLates, setDraftFreeLates] = useState(freeLatesPerMonth);

  return (
    <SectionCard
      title="Late arrival policy"
      description="Automatically convert repeated late arrivals into a half-day leave deduction."
      action={<StatusBadge status={enabled ? "Active" : "Inactive"} />}
    >
      <div className="space-y-4">
        {(saveState.error || toggleState.error) && (
          <ErrorAlert message={(saveState.error || toggleState.error)!} />
        )}
        {(saveState.success || toggleState.success) && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {saveState.success || toggleState.success}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          When enabled, a check-in later than a shift&apos;s start time plus its grace
          period counts as a late arrival. Once an employee exceeds the free
          allowance below in a calendar month, each further late arrival that month
          auto-applies a 0.5-day leave (Casual Leave, falling back to loss of pay if
          the balance is insufficient). Employees can contest a specific day via
          Attendance Regularization — an approved regularization reverses the
          auto-applied half-day and refunds the balance. Turning this on only
          affects days from today onward; past attendance and leave records are
          never rewritten.
        </p>

        <form action={saveAction} className="max-w-xs space-y-2">
          <Label htmlFor="freeLatesPerMonth">Free late arrivals per month</Label>
          <Input
            id="freeLatesPerMonth"
            name="freeLatesPerMonth"
            type="number"
            min={0}
            max={10}
            value={draftFreeLates}
            onChange={(e) => setDraftFreeLates(Number(e.target.value))}
            disabled={!canEdit}
          />
          {canEdit && (
            <input type="hidden" name="enabled" value={enabled.toString()} />
          )}
          {canEdit && (
            <Button type="submit" loading={savePending} className="mt-2">
              Save
            </Button>
          )}
        </form>

        {canEdit && (
          <form action={toggleAction}>
            <input type="hidden" name="enabled" value={(!enabled).toString()} />
            <input type="hidden" name="freeLatesPerMonth" value={draftFreeLates} />
            <Button variant="outline" type="submit" loading={togglePending}>
              {enabled ? "Disable policy" : "Enable policy"}
            </Button>
          </form>
        )}
      </div>
    </SectionCard>
  );
}
