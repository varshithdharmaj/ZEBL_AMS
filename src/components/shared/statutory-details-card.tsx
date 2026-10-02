"use client";

import { useState, useTransition, type ReactNode } from "react";
import { revealStatutoryDetailsAction } from "@/actions/employee-statutory";
import type { StatutoryFields } from "@/lib/security/statutory-details";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { SectionCard } from "@/components/ui/section-card";

const FIELD_LABELS: { key: keyof StatutoryFields; label: string }[] = [
  { key: "pan", label: "PAN" },
  { key: "aadhaar", label: "Aadhaar" },
  { key: "uan", label: "UAN" },
  { key: "esiNumber", label: "ESI number" },
  { key: "bankAccountNo", label: "Bank account number" },
  { key: "ifsc", label: "IFSC code" },
  { key: "bankName", label: "Bank name" },
  { key: "bankBranchName", label: "Bank branch name" },
];

/**
 * Masked statutory details with an optional "Show unmasked" toggle. Unmasked values are
 * fetched from the server on each click (which audit-logs the view) rather than sent with
 * the page. Shared by the HR employee profile and the employee's own profile.
 */
export function StatutoryDetailsCard({
  employeeId,
  masked,
  canUnmask,
  title = "Statutory details",
  description,
  footer,
}: {
  employeeId: number;
  masked: StatutoryFields;
  canUnmask: boolean;
  title?: string;
  description?: string;
  footer?: ReactNode;
}) {
  const [revealed, setRevealed] = useState<{ source: StatutoryFields; values: StatutoryFields } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [revealing, startReveal] = useTransition();
  // A save refreshes `masked`; drop values revealed before it instead of showing stale ones.
  const unmasked = revealed && revealed.source === masked ? revealed.values : null;
  const displayed = unmasked ?? masked;

  function toggleUnmasked() {
    if (unmasked) {
      setRevealed(null);
      return;
    }
    startReveal(async () => {
      const result = await revealStatutoryDetailsAction(employeeId);
      if ("values" in result) {
        setRevealed({ source: masked, values: result.values });
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <SectionCard
      title={title}
      description={description}
      action={
        canUnmask ? (
          <Button type="button" variant="outline" size="sm" onClick={toggleUnmasked} loading={revealing}>
            {unmasked ? "Hide" : "Show"} unmasked
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <dl className="grid gap-4 sm:grid-cols-2">
          {FIELD_LABELS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium text-foreground">{displayed[key] ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {footer}
      </div>
    </SectionCard>
  );
}
