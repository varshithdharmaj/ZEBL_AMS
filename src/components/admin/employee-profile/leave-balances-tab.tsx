"use client";

import { useActionState, useState } from "react";
import { adjustLeaveBalanceAction, syncEmployeeAccrualsAction, type ActionState } from "@/actions/leave-balances";
import { LeaveBalanceGrid } from "@/components/leave/leave-balance-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";

const initialState: ActionState = {};

export function LeaveBalancesTab({
  employeeId,
  balances,
}: {
  employeeId: number;
  balances: LeaveBalanceSummary[];
}) {
  const [state, formAction, pending] = useActionState(adjustLeaveBalanceAction, initialState);
  const [leaveType, setLeaveType] = useState("CL");
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    await syncEmployeeAccrualsAction(employeeId);
    setSyncing(false);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? "Processing…" : "Process accruals"}
        </Button>
      </div>

      <LeaveBalanceGrid balances={balances} />

      <SectionCard title="Adjust balance" description="Creates a transaction record for every change">
        <form action={formAction} className="max-w-md space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="leaveType" value={leaveType} />
          <input type="hidden" name="mode" value={mode} />
          {state.error && <ErrorAlert message={state.error} />}
          {state.success && (
            <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
              {state.success}
            </p>
          )}
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setMode("delta")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "delta" ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                Add/Deduct
              </button>
              <button
                type="button"
                onClick={() => setMode("set")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "set" ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                Set to
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Leave type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
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
          {mode === "set" ? (
            <div className="space-y-2">
              <Label htmlFor="target">New balance</Label>
              <Input id="target" name="target" type="number" step="0.5" min="0" required />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="adjustment">Amount (+ add / − deduct)</Label>
              <Input id="adjustment" name="adjustment" type="number" step="0.5" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="note">Reason</Label>
            <Input id="note" name="note" required placeholder="Reason for adjustment" />
          </div>
          <Button type="submit" loading={pending}>
            {pending ? "Applying…" : "Apply"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
