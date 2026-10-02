"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  revealStatutoryDetailsAction,
  upsertEmployeeStatutoryDetailAction,
} from "@/actions/employee-statutory";
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

const FORM_FIELDS: { key: keyof StatutoryFields; label: string; placeholder?: string }[] = [
  { key: "pan", label: "PAN", placeholder: "ABCDE1234F" },
  { key: "aadhaar", label: "Aadhaar", placeholder: "123456789012" },
  { key: "uan", label: "UAN" },
  { key: "esiNumber", label: "ESI number" },
  { key: "bankAccountNo", label: "Bank account number" },
  { key: "ifsc", label: "IFSC code", placeholder: "HDFC0001234" },
  { key: "bankName", label: "Bank name" },
  { key: "bankBranchName", label: "Bank branch name" },
];

export function StatutoryDetailsTab({
  employeeId,
  problem,
  masked,
  canEdit,
  canUnmask,
}: {
  employeeId: number;
  problem: StatutoryDetailProblem | null;
  masked: StatutoryFields | null;
  canEdit: boolean;
  canUnmask: boolean;
}) {
  // Full values exist in the browser only while editing; they are fetched (and audit-logged)
  // when HR clicks Edit, never sent with the page.
  const [editValues, setEditValues] = useState<StatutoryFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();
  const [saving, startSaving] = useTransition();

  if (problem || !masked) {
    return (
      <SectionCard title="Statutory details">
        <p className="rounded-lg border border-warning/20 bg-warning-muted px-4 py-3 text-sm text-warning">
          {PROBLEM_MESSAGES[problem ?? "undecryptable"]}
        </p>
      </SectionCard>
    );
  }

  const isEmpty = Object.values(masked).every((value) => !value);

  function openEditor() {
    setError(null);
    setSuccess(null);
    if (isEmpty) {
      setEditValues(Object.fromEntries(FORM_FIELDS.map(({ key }) => [key, null])) as StatutoryFields);
      return;
    }
    startOpening(async () => {
      const result = await revealStatutoryDetailsAction(employeeId);
      if ("values" in result) setEditValues(result.values);
      else setError(result.error);
    });
  }

  function closeEditor() {
    setEditValues(null);
    setError(null);
  }

  // Calling the action directly (not via <form action>) keeps what HR typed when validation
  // fails, because React resets uncontrolled inputs after a form action completes.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await upsertEmployeeStatutoryDetailAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditValues(null);
      setError(null);
      setSuccess(result.success ?? "Statutory details saved.");
    });
  }

  if (editValues) {
    return (
      <SectionCard
        title={isEmpty ? "Add statutory details" : "Edit statutory details"}
        description="Visible only to HR/Super Admin. Saving a new bank account or IFSC emails the employee."
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="hidden" name="employeeId" value={employeeId} />
          {error && <ErrorAlert message={error} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FORM_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} name={key} defaultValue={editValues[key] ?? ""} placeholder={placeholder} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" loading={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </SectionCard>
    );
  }

  return (
    <StatutoryDetailsCard
      employeeId={employeeId}
      masked={masked}
      canUnmask={canUnmask && !isEmpty}
      description={
        isEmpty ? "No statutory details saved yet." : "PAN, Aadhaar and bank details are masked by default."
      }
      headerActions={
        canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={openEditor} loading={opening}>
            {!opening && (isEmpty ? <Plus className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />)}
            {isEmpty ? "Add details" : "Edit"}
          </Button>
        ) : undefined
      }
      notice={
        <>
          {error && <ErrorAlert message={error} />}
          {success && (
            <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
              {success}
            </p>
          )}
        </>
      }
    />
  );
}
