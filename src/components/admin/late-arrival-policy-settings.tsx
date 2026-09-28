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
import type { LateArrivalPolicyOverview } from "@/lib/attendance/late-arrival-policy-settings";

const initialState: LateArrivalPolicyActionState = {};

export function LateArrivalPolicySettings({
  enabled,
  freeLatesPerMonth,
  effectiveFromLabel,
  overview,
  canEdit,
}: {
  enabled: boolean;
  freeLatesPerMonth: number;
  /** Formatted first attendance date the policy evaluates; null while disabled. */
  effectiveFromLabel: string | null;
  overview: LateArrivalPolicyOverview;
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
          A check-in later than the employee&apos;s shift start plus its grace period
          counts as a late arrival. Once an employee uses up the free allowance below
          in a calendar month, each further late arrival that month auto-applies a
          0.5-day Casual Leave (loss of pay if the CL balance is insufficient).
          Holidays, weekly offs, days with leave already applied, and regularised days
          are never counted. Employees contest a specific day through Attendance
          Regularisation — once HR approves it, the half-day is cancelled and the
          balance refunded. Turning the policy on takes effect from the next day;
          earlier attendance is never re-evaluated.
        </p>

        {enabled && effectiveFromLabel && (
          <p className="text-sm text-foreground">
            Evaluating attendance from <span className="font-medium">{effectiveFromLabel}</span>.
          </p>
        )}

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Late arrivals ({overview.monthKey})</dt>
            <dd className="font-medium text-foreground">{overview.latesThisMonth}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Half-days applied</dt>
            <dd className="font-medium text-foreground">{overview.halfDaysThisMonth}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reversed by regularisation</dt>
            <dd className="font-medium text-foreground">{overview.reversedThisMonth}</dd>
          </div>
        </dl>

        {overview.activeEmployeesWithoutShift > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning-muted p-3 text-sm text-foreground">
            {overview.activeEmployeesWithoutShift} active employee
            {overview.activeEmployeesWithoutShift === 1 ? " has" : "s have"} no active shift
            assigned, so their late arrivals can&apos;t be detected. Assign a shift from each
            employee&apos;s profile to bring them under this policy.
          </div>
        )}

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
