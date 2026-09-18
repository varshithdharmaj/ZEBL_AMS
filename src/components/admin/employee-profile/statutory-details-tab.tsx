"use client";

import { useActionState, useState } from "react";
import { upsertEmployeeStatutoryDetailAction } from "@/actions/employee-statutory";
import type { ActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";

export type StatutoryFields = {
  pan: string | null;
  aadhaar: string | null;
  uan: string | null;
  pfNumber: string | null;
  esiNumber: string | null;
  bankAccountNo: string | null;
  ifsc: string | null;
  bankName: string | null;
};

const FIELD_LABELS: { key: keyof StatutoryFields; label: string }[] = [
  { key: "pan", label: "PAN" },
  { key: "aadhaar", label: "Aadhaar" },
  { key: "uan", label: "UAN" },
  { key: "pfNumber", label: "PF number" },
  { key: "esiNumber", label: "ESI number" },
  { key: "bankAccountNo", label: "Bank account number" },
  { key: "ifsc", label: "IFSC code" },
  { key: "bankName", label: "Bank name" },
];

const initialState: ActionState = {};

export function StatutoryDetailsTab({
  employeeId,
  masked,
  unmasked,
  canEdit,
  canUnmask,
}: {
  employeeId: number;
  masked: StatutoryFields;
  unmasked: StatutoryFields | null;
  canEdit: boolean;
  canUnmask: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    upsertEmployeeStatutoryDetailAction,
    initialState
  );
  const [showUnmasked, setShowUnmasked] = useState(false);
  const displayed = showUnmasked && unmasked ? unmasked : masked;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Statutory details"
        description="PAN, Aadhaar and bank details are masked by default."
        action={
          canUnmask ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUnmasked((v) => !v)}
            >
              {showUnmasked ? "Hide" : "Show"} unmasked
            </Button>
          ) : undefined
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          {FIELD_LABELS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium text-foreground">{displayed[key] ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      {canEdit && (
        <SectionCard title="Edit statutory details" description="Visible only to HR/Super Admin.">
          <form action={formAction} className="space-y-5">
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
                <Input id="pan" name="pan" defaultValue={unmasked?.pan ?? ""} placeholder="ABCDE1234F" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aadhaar">Aadhaar</Label>
                <Input
                  id="aadhaar"
                  name="aadhaar"
                  defaultValue={unmasked?.aadhaar ?? ""}
                  placeholder="123456789012"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uan">UAN</Label>
                <Input id="uan" name="uan" defaultValue={unmasked?.uan ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pfNumber">PF number</Label>
                <Input id="pfNumber" name="pfNumber" defaultValue={unmasked?.pfNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="esiNumber">ESI number</Label>
                <Input id="esiNumber" name="esiNumber" defaultValue={unmasked?.esiNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountNo">Bank account number</Label>
                <Input
                  id="bankAccountNo"
                  name="bankAccountNo"
                  defaultValue={unmasked?.bankAccountNo ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc">IFSC code</Label>
                <Input id="ifsc" name="ifsc" defaultValue={unmasked?.ifsc ?? ""} placeholder="HDFC0001234" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank name</Label>
                <Input id="bankName" name="bankName" defaultValue={unmasked?.bankName ?? ""} />
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
