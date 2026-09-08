"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import {
  cancelLeaveBalanceImportPreviewAction,
  confirmLeaveBalanceImportAction,
  uploadLeaveBalanceImportPreviewAction,
  type LeaveBalanceImportConfirmState,
  type LeaveBalanceImportPreviewState,
} from "@/actions/leave-balance-import";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { ErrorAlert } from "@/components/ui/error-alert";
import type { LeaveBalanceImportPreview, LeaveBalanceImportRowStatus } from "@/lib/leave/import/preview-types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<LeaveBalanceImportRowStatus, string> = {
  valid: "Valid",
  no_change: "No change",
  warning: "Warning",
  error: "Error",
  duplicate: "Duplicate",
};

const STATUS_CLASS: Record<LeaveBalanceImportRowStatus, string> = {
  valid: "bg-success-muted text-success",
  no_change: "bg-muted text-muted-foreground",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  error: "bg-destructive/10 text-destructive",
  duplicate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function formatValue(v: number | null): string {
  return v == null ? "—" : String(v);
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["employeeCode", "el", "cl", "sl", "reason"],
    ["EMP001", "12", "6", "4", "Excel migration — opening balance"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Opening Balances");
  XLSX.writeFile(wb, "leave-balance-import-template.xlsx");
}

function PreviewTable({ preview }: { preview: LeaveBalanceImportPreview }) {
  return (
    <DataTable columns={["Row", "Employee", "EL", "CL", "SL", "Status", "Notes"]}>
      {preview.rows.map((row) => (
        <DataTableRow key={row.rowIndex}>
          <DataTableCell className="tabular-nums text-muted-foreground">{row.rowIndex}</DataTableCell>
          <DataTableCell>
            <p className="font-medium">{row.employeeName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{row.employeeCode}</p>
          </DataTableCell>
          <DataTableCell className="tabular-nums">
            {formatValue(row.current.el)} → {formatValue(row.target.el)}
          </DataTableCell>
          <DataTableCell className="tabular-nums">
            {formatValue(row.current.cl)} → {formatValue(row.target.cl)}
          </DataTableCell>
          <DataTableCell className="tabular-nums">
            {formatValue(row.current.sl)} → {formatValue(row.target.sl)}
          </DataTableCell>
          <DataTableCell>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[row.status])}>
              {STATUS_LABEL[row.status]}
            </span>
          </DataTableCell>
          <DataTableCell className="text-xs text-muted-foreground">
            {row.messages.join(" ") || "—"}
          </DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  );
}

type Step = "upload" | "preview" | "done";

export function LeaveBalanceImportForm() {
  const [previewState, previewAction, previewPending] = useActionState(
    uploadLeaveBalanceImportPreviewAction,
    {} as LeaveBalanceImportPreviewState
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmLeaveBalanceImportAction,
    {} as LeaveBalanceImportConfirmState
  );
  const [, startCancelTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeaveBalanceImportPreview | null>(null);
  const [step, setStep] = useState<Step>("upload");

  useEffect(() => {
    if (previewState.preview) {
      setPreview(previewState.preview);
      setStep("preview");
    }
  }, [previewState.preview]);

  useEffect(() => {
    if (confirmState.success) {
      setStep("done");
    }
  }, [confirmState.success]);

  function resetToUpload() {
    const previewId = preview?.previewId;
    setPreview(null);
    setStep("upload");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (previewId) {
      const fd = new FormData();
      fd.set("previewId", previewId);
      startCancelTransition(() => {
        void cancelLeaveBalanceImportPreviewAction({}, fd);
      });
    }
  }

  function handleConfirm() {
    if (!preview) return;
    const fd = new FormData();
    fd.set("previewId", preview.previewId);
    confirmAction(fd);
  }

  if (step === "done" && confirmState.success) {
    return (
      <SectionCard title="Import complete" description="Opening balances were applied successfully." className="max-w-3xl">
        <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
          {confirmState.success}
        </p>
        <div className="mt-4">
          <Button type="button" onClick={resetToUpload}>
            Import another file
          </Button>
        </div>
      </SectionCard>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div className="max-w-6xl space-y-4">
        {confirmState.error && <ErrorAlert message={confirmState.error} />}
        <SectionCard
          title="Preview"
          description={`${preview.summary.totalRows} row(s) — ${preview.summary.validRows} valid, ${preview.summary.warningRows} warning, ${preview.summary.noChangeRows} no-change, ${preview.summary.duplicateRows} duplicate, ${preview.summary.errorRows} error`}
        >
          <div className="space-y-4">
            <PreviewTable preview={preview} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleConfirm} loading={confirmPending} disabled={!preview.canConfirm}>
                {confirmPending ? "Applying…" : "Confirm import"}
              </Button>
              <Button type="button" variant="outline" onClick={resetToUpload} disabled={confirmPending}>
                Cancel
              </Button>
            </div>
            {!preview.canConfirm && (
              <p className="text-xs text-destructive">
                Fix the {preview.summary.errorRows} error row(s) above and re-upload before confirming.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <SectionCard title="Upload file" description="Excel (.xlsx/.xls) or CSV — preview before anything is written" className="max-w-xl">
      <form action={previewAction} className="space-y-5">
        {previewState.error && <ErrorAlert message={previewState.error} />}

        <div className="space-y-2">
          <Label htmlFor={fileInputId}>Opening balance file</Label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            name="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            disabled={previewPending}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
          />
          <p className="text-xs text-muted-foreground">
            Columns: employeeCode (required), el, cl, sl, reason (optional). Blank cells leave that
            leave type untouched. Values set the balance to exactly what&rsquo;s in the file — EL is
            allowed regardless of the 1-year eligibility rule, since this represents balance already
            earned in Excel.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Download template
          </button>
        </div>

        <Button type="submit" loading={previewPending} disabled={!selectedFile}>
          {previewPending ? "Parsing…" : "Preview import"}
        </Button>
      </form>
    </SectionCard>
  );
}
