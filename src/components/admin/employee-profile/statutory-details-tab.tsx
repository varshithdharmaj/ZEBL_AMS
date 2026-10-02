"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { upsertEmployeeStatutoryDetailAction } from "@/actions/employee-statutory";
import type { ActionState } from "@/actions/types";
import type { StatutoryDetailProblem, StatutoryFields } from "@/lib/security/statutory-details";
import { StatutoryDetailsCard } from "@/components/shared/statutory-details-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";

const PROBLEM_MESSAGES: Record<StatutoryDetailProblem, string> = {
  missing_key:
    "Statutory details can't be viewed or saved because the server's encryption key (EMPLOYEE_FIELD_ENCRYPTION_KEY) isn't configured. Ask your system administrator to set it.",
  undecryptable:
    "These statutory details were saved with a different encryption key, so they can't be read or changed. Check that EMPLOYEE_FIELD_ENCRYPTION_KEY matches the key used when they were saved.",
};

const initialState: ActionState = {};

export function StatutoryDetailsTab({
  employeeId,
  problem,
  masked,
  editValues,
  canEdit,
  canUnmask,
}: {
  employeeId: number;
  problem: StatutoryDetailProblem | null;
  masked: StatutoryFields | null;
  /** Current values to pre-fill the edit form; only passed to users who can edit. */
  editValues: StatutoryFields | null;
  canEdit: boolean;
  canUnmask: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    upsertEmployeeStatutoryDetailAction,
    initialState
  );

  if (problem || !masked) {
    return (
      <SectionCard title="Statutory details">
        <p className="rounded-lg border border-warning/20 bg-warning-muted px-4 py-3 text-sm text-warning">
          {PROBLEM_MESSAGES[problem ?? "undecryptable"]}
        </p>
      </SectionCard>
    );
  }

  // Dispatch manually instead of <form action>: React resets uncontrolled inputs after a
  // form action completes, which would wipe everything HR typed when validation fails.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="space-y-6">
      <StatutoryDetailsCard
        employeeId={employeeId}
        masked={masked}
        canUnmask={canUnmask}
        description="PAN, Aadhaar and bank details are masked by default."
      />

      {canEdit && (
        <SectionCard title="Edit statutory details" description="Visible only to HR/Super Admin.">
          <form onSubmit={handleSubmit} className="space-y-5">
            <input type="hidden" name="employeeId" value={employeeId} />
            {state.error && <ErrorAlert message={state.error} />}
            {state.success && (
              <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
                {state.success}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pan">PAN</Label>
                <Input id="pan" name="pan" defaultValue={editValues?.pan ?? ""} placeholder="ABCDE1234F" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aadhaar">Aadhaar</Label>
                <Input
                  id="aadhaar"
                  name="aadhaar"
                  defaultValue={editValues?.aadhaar ?? ""}
                  placeholder="123456789012"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uan">UAN</Label>
                <Input id="uan" name="uan" defaultValue={editValues?.uan ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="esiNumber">ESI number</Label>
                <Input id="esiNumber" name="esiNumber" defaultValue={editValues?.esiNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountNo">Bank account number</Label>
                <Input
                  id="bankAccountNo"
                  name="bankAccountNo"
                  defaultValue={editValues?.bankAccountNo ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc">IFSC code</Label>
                <Input id="ifsc" name="ifsc" defaultValue={editValues?.ifsc ?? ""} placeholder="HDFC0001234" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank name</Label>
                <Input id="bankName" name="bankName" defaultValue={editValues?.bankName ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankBranchName">Bank branch name</Label>
                <Input
                  id="bankBranchName"
                  name="bankBranchName"
                  defaultValue={editValues?.bankBranchName ?? ""}
                />
              </div>
            </div>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
