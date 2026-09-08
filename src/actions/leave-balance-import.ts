"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guards";
import {
  LEAVE_BALANCE_IMPORT_MAX_FILE_SIZE,
  validateLeaveBalanceImportFile,
} from "@/lib/leave/import/file-validation";
import { parseLeaveBalanceImportFile } from "@/lib/leave/import/parse-file";
import { buildLeaveBalanceImportPreview } from "@/lib/leave/import/build-preview";
import { commitLeaveBalanceImport } from "@/lib/leave/import/commit-import";
import {
  deleteLeaveBalanceImportPreviewCache,
  putLeaveBalanceImportPreviewCache,
} from "@/lib/leave/import/preview-cache";
import type { LeaveBalanceImportPreview } from "@/lib/leave/import/preview-types";

export type LeaveBalanceImportPreviewState = {
  error?: string;
  preview?: LeaveBalanceImportPreview;
};

export type LeaveBalanceImportConfirmState = {
  error?: string;
  success?: string;
  importBatchId?: number;
  applied?: number;
  skipped?: number;
};

export type LeaveBalanceImportCancelState = {
  error?: string;
  cancelled?: boolean;
};

export async function uploadLeaveBalanceImportPreviewAction(
  _prev: LeaveBalanceImportPreviewState,
  formData: FormData
): Promise<LeaveBalanceImportPreviewState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Please select an Excel (.xlsx/.xls) or CSV file." };
  }

  const validation = validateLeaveBalanceImportFile({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  });
  if (!validation.ok) {
    return { error: validation.error };
  }

  if (file.size > LEAVE_BALANCE_IMPORT_MAX_FILE_SIZE) {
    return { error: "File size exceeds 5MB limit." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = parseLeaveBalanceImportFile(buffer);
    if (!parseResult.ok) {
      return { error: parseResult.error };
    }

    const previewId = randomUUID();
    const preview = await buildLeaveBalanceImportPreview({
      previewId,
      fileName: file.name,
      fileSize: file.size,
      rows: parseResult.rows,
    });

    putLeaveBalanceImportPreviewCache({
      previewId,
      userId: session.id,
      fileName: file.name,
      fileSize: file.size,
      rows: parseResult.rows,
    });

    return { preview };
  } catch (e) {
    console.error("Leave balance import preview error:", e);
    return { error: "Failed to preview the file. Please check the format and try again." };
  }
}

export async function confirmLeaveBalanceImportAction(
  _prev: LeaveBalanceImportConfirmState,
  formData: FormData
): Promise<LeaveBalanceImportConfirmState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const previewId = String(formData.get("previewId") ?? "").trim();
  if (!previewId) {
    return { error: "Preview expired or missing. Please upload the file again." };
  }

  const result = await commitLeaveBalanceImport({ previewId, session });
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/leaves");
  revalidatePath("/admin/employees/[id]", "layout");
  revalidatePath("/employee/leaves");
  revalidatePath("/employee/dashboard");

  return {
    success: `Import batch #${result.importBatchId}: applied ${result.applied}, no-change/skipped ${result.skipped}.`,
    importBatchId: result.importBatchId,
    applied: result.applied,
    skipped: result.skipped,
  };
}

export async function cancelLeaveBalanceImportPreviewAction(
  _prev: LeaveBalanceImportCancelState,
  formData: FormData
): Promise<LeaveBalanceImportCancelState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const previewId = String(formData.get("previewId") ?? "").trim();
  if (previewId) {
    deleteLeaveBalanceImportPreviewCache(previewId, session.id);
  }
  return { cancelled: true };
}
