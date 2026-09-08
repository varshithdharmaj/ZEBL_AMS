import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { adminSetLeaveBalance } from "@/lib/leave";
import { adminSetElBalance } from "@/lib/leave/el-fifo";
import type { SessionUser } from "@/lib/session";
import { buildLeaveBalanceImportPreview } from "./build-preview";
import {
  deleteLeaveBalanceImportPreviewCache,
  getLeaveBalanceImportPreviewCache,
} from "./preview-cache";

type TxClient = Prisma.TransactionClient;

export type CommitLeaveBalanceImportResult =
  | { ok: true; importBatchId: number; applied: number; skipped: number; errorRows: number }
  | { ok: false; error: string };

export async function commitLeaveBalanceImport(params: {
  previewId: string;
  session: SessionUser;
}): Promise<CommitLeaveBalanceImportResult> {
  const { previewId, session } = params;

  const cached = getLeaveBalanceImportPreviewCache(previewId, session.id);
  if (!cached) {
    return { ok: false, error: "Preview expired — please re-upload the file." };
  }

  // Re-validate on the cached raw rows inside commit — never trust the stale
  // preview, since employees may have changed between preview and confirm.
  const preview = await buildLeaveBalanceImportPreview({
    previewId,
    fileName: cached.fileName,
    fileSize: cached.fileSize,
    rows: cached.rows,
  });

  if (!preview.canConfirm) {
    return {
      ok: false,
      error: "This preview has blocking errors. Fix the file before confirming.",
    };
  }

  try {
    const result = await prisma.$transaction(
      async (tx: TxClient) => {
        const batch = await tx.leaveBalanceImportBatch.create({
          data: {
            fileName: cached.fileName,
            totalRows: preview.summary.totalRows,
            createdBy: session.email,
          },
        });

        const importableRows = preview.rows.filter((r) => r.importable);
        const codes = [...new Set(importableRows.map((r) => r.employeeCode))];
        const employees = await tx.employee.findMany({
          where: { employeeCode: { in: codes } },
          select: { id: true, employeeCode: true },
        });
        const idByCode = new Map(employees.map((e) => [e.employeeCode, e.id]));

        let applied = 0;
        let skipped = 0;

        for (const row of importableRows) {
          const employeeId = idByCode.get(row.employeeCode);
          if (employeeId == null) continue; // re-validated preview already excludes unknown codes; defensive only

          if (row.target.cl != null) {
            const r = await adminSetLeaveBalance({
              employeeId,
              leaveType: "CL",
              targetBalance: row.target.cl,
              reason: row.reason,
              createdBy: session.email,
              transactionType: "opening_balance",
              importBatchId: batch.id,
              tx,
            });
            if (r.skipped) skipped++; else applied++;
          }
          if (row.target.sl != null) {
            const r = await adminSetLeaveBalance({
              employeeId,
              leaveType: "SL",
              targetBalance: row.target.sl,
              reason: row.reason,
              createdBy: session.email,
              transactionType: "opening_balance",
              importBatchId: batch.id,
              tx,
            });
            if (r.skipped) skipped++; else applied++;
          }
          if (row.target.el != null) {
            const r = await adminSetElBalance({
              employeeId,
              targetBalance: row.target.el,
              reason: row.reason,
              createdBy: session.email,
              transactionType: "opening_balance",
              importBatchId: batch.id,
              tx,
            });
            if (r.skipped) skipped++; else applied++;
          }
        }

        await tx.leaveBalanceImportBatch.update({
          where: { id: batch.id },
          data: {
            appliedCount: applied,
            skippedCount: skipped,
            errorCount: preview.summary.errorRows,
          },
        });

        await writeAuditLog(
          {
            entityType: "leave_balance_import_batch",
            entityId: String(batch.id),
            action: AUDIT_ACTIONS.LEAVE_BALANCE_IMPORT_COMPLETED,
            actorUserId: session.id,
            actorEmail: session.email,
            employeeId: session.employeeId,
            module: "leave",
            description: "Leave balance opening-balance import completed.",
            metadata: {
              importBatchId: batch.id,
              fileName: cached.fileName,
              totalRows: preview.summary.totalRows,
              applied,
              skipped,
              errorRows: preview.summary.errorRows,
            },
          },
          tx
        );

        return { importBatchId: batch.id, applied, skipped };
      },
      { maxWait: 20000, timeout: 120000 }
    );

    deleteLeaveBalanceImportPreviewCache(previewId, session.id);

    return {
      ok: true,
      importBatchId: result.importBatchId,
      applied: result.applied,
      skipped: result.skipped,
      errorRows: preview.summary.errorRows,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed due to a server error.";
    return { ok: false, error: message };
  }
}
