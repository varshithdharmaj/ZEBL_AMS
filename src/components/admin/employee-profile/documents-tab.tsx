"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import {
  deleteEmployeeDocumentAction,
  uploadEmployeeDocumentAction,
} from "@/actions/employee-documents";
import type { ActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { EmployeeDocumentType } from "@/generated/prisma/enums";
import {
  EMPLOYEE_DOCUMENT_ACCEPT,
  EMPLOYEE_DOCUMENT_MAX_BYTES,
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  checkEmployeeDocumentFile,
} from "@/lib/validation/schemas/employee-document";

export type EmployeeDocumentRow = {
  id: string;
  documentType: EmployeeDocumentType;
  fileName: string;
  sizeBytes: number | null;
  createdAt: Date;
  uploadedByEmail: string | null;
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const initialState: ActionState = {};

function DocumentRow({
  doc,
  employeeId,
  canDelete,
}: {
  doc: EmployeeDocumentRow;
  employeeId: number;
  canDelete: boolean;
}) {
  const [state, deleteAction, pending] = useActionState(deleteEmployeeDocumentAction, initialState);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function confirmDelete() {
    const formData = new FormData();
    formData.set("id", doc.id);
    formData.set("employeeId", String(employeeId));
    setConfirmOpen(false);
    startTransition(() => deleteAction(formData));
  }

  return (
    <DataTableRow>
      <DataTableCell>{EMPLOYEE_DOCUMENT_TYPE_LABELS[doc.documentType]}</DataTableCell>
      <DataTableCell className="max-w-[240px] truncate">{doc.fileName}</DataTableCell>
      <DataTableCell className="tabular-nums text-xs text-muted-foreground">
        {formatFileSize(doc.sizeBytes)}
      </DataTableCell>
      <DataTableCell className="text-xs text-muted-foreground">
        {formatDate(doc.createdAt)}
      </DataTableCell>
      <DataTableCell>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/employee-documents/download?id=${encodeURIComponent(doc.id)}`}>
              Download
            </a>
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={pending}
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
          )}
        </div>
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
        {canDelete && (
          <AlertDialog
            isOpen={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete this document?"
            description={`"${doc.fileName}" will be permanently deleted and removed from the employee's profile. This can't be undone.`}
            actionLabel="Delete"
            isActionDestructive
            onAction={confirmDelete}
          />
        )}
      </DataTableCell>
    </DataTableRow>
  );
}

export function DocumentsTab({
  employeeId,
  documents,
  canManage,
}: {
  employeeId: number;
  documents: EmployeeDocumentRow[];
  canManage: boolean;
}) {
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadEmployeeDocumentAction,
    initialState
  );
  const [documentType, setDocumentType] = useState<EmployeeDocumentType>(
    EmployeeDocumentType.OTHER
  );
  const [fileError, setFileError] = useState<string | null>(null);

  // Check before sending: a file over the Server Action body limit is rejected by Next.js
  // before our action runs, which surfaces as a page error instead of a form message.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const file = new FormData(event.currentTarget).get("file");
    const error =
      file instanceof File && file.size > 0
        ? checkEmployeeDocumentFile(file.name, file.type || "application/octet-stream", file.size)
        : null;
    setFileError(error);
    if (error) event.preventDefault();
  }

  const errorMessage = fileError ?? uploadState.error;

  return (
    <div className="space-y-6">
      {canManage && (
        <SectionCard
          title="Upload document"
          description={`PDF, DOC, DOCX, JPG, PNG or WEBP, up to ${EMPLOYEE_DOCUMENT_MAX_BYTES / (1024 * 1024)}MB. The employee can see and download these on their profile.`}
        >
          <form action={uploadAction} onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="documentType" value={documentType} />
            {errorMessage && <ErrorAlert message={errorMessage} />}
            {uploadState.success && (
              <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
                {uploadState.success}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Document type</Label>
                <Select
                  value={documentType}
                  onValueChange={(value) => setDocumentType(value as EmployeeDocumentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(EmployeeDocumentType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {EMPLOYEE_DOCUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input id="file" name="file" type="file" accept={EMPLOYEE_DOCUMENT_ACCEPT} required />
              </div>
            </div>
            <Button type="submit" loading={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Documents" noPadding>
        <DataTable
          columns={["Type", "File name", "Size", "Uploaded", "Actions"]}
          emptyMessage="No documents uploaded yet."
        >
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} employeeId={employeeId} canDelete={canManage} />
          ))}
        </DataTable>
      </SectionCard>
    </div>
  );
}
