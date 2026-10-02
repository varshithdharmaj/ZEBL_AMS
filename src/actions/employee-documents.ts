"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { prisma } from "@/lib/prisma";
import { requireManageEmployeeSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  checkEmployeeDocumentFile,
  employeeDocumentIdSchema,
  uploadEmployeeDocumentMetaSchema,
} from "@/lib/validation/schemas/employee-document";
import { buildEmployeeDocumentStorageKey } from "@/lib/recruitment/shared/storage-paths";
import { getEmployeeStorage } from "@/lib/recruitment/storage/employee-storage";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import { EmployeeDocumentType } from "@/generated/prisma/enums";

function checksumBuffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function uploadEmployeeDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireManageEmployeeSession();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "A non-empty file is required." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = safeParseWithSchema(uploadEmployeeDocumentMetaSchema, {
      employeeId: formData.get("employeeId"),
      documentType: formData.get("documentType") ?? EmployeeDocumentType.OTHER,
      fileName: file.name || "upload.bin",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      checksum: checksumBuffer(buffer),
    });
    if (!meta.ok) return { error: meta.error };
    const data = meta.data;

    const validationError = checkEmployeeDocumentFile(data.fileName, data.mimeType, data.sizeBytes);
    if (validationError) return { error: validationError };

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) return { error: "Employee not found." };

    const storageKey = buildEmployeeDocumentStorageKey(data.employeeId, data.fileName);
    const storage = getEmployeeStorage();
    await storage.save(storageKey, buffer, { contentType: data.mimeType });

    const requestContext = await getRequestSecurityContext();
    try {
      await prisma.$transaction(async (tx) => {
        const doc = await tx.employeeDocument.create({
          data: {
            employeeId: data.employeeId,
            documentType: data.documentType,
            fileName: data.fileName,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            storageKey,
            checksum: data.checksum,
            uploadedByUserId: session.id,
          },
        });

        await writeAuditLog(
          {
            entityType: "employee_document",
            entityId: doc.id,
            action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
            actorUserId: session.id,
            actorEmail: session.email,
            employeeId: data.employeeId,
            module: "employees",
            description: "Employee document was uploaded.",
            metadata: { documentType: data.documentType, fileName: data.fileName },
            requestContext,
          },
          tx
        );
      });
    } catch (error) {
      await storage.delete(storageKey).catch(() => undefined);
      throw error;
    }

    revalidatePath(`/admin/employees/${data.employeeId}`);
    return { success: "Document uploaded successfully." };
  } catch (error) {
    console.error("[employee-documents] upload failed:", error instanceof Error ? error.message : error);
    return { error: "Failed to upload document." };
  }
}

export async function deleteEmployeeDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireManageEmployeeSession();

    const parsed = safeParseWithSchema(employeeDocumentIdSchema, {
      id: formData.get("id"),
      employeeId: formData.get("employeeId"),
    });
    if (!parsed.ok) return { error: parsed.error };
    const { id, employeeId } = parsed.data;

    const doc = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!doc || doc.employeeId !== employeeId || doc.deletedAt) {
      return { error: "Document not found." };
    }

    const requestContext = await getRequestSecurityContext();
    await prisma.$transaction(async (tx) => {
      await tx.employeeDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await writeAuditLog(
        {
          entityType: "employee_document",
          entityId: id,
          action: AUDIT_ACTIONS.DOCUMENT_DELETED,
          actorUserId: session.id,
          actorEmail: session.email,
          employeeId,
          module: "employees",
          description: "Employee document was deleted.",
          metadata: { documentType: doc.documentType, fileName: doc.fileName },
          requestContext,
        },
        tx
      );
    });

    // The soft-deleted row stays as a record that the document existed; the file itself is
    // removed so a deleted document is really gone.
    await getEmployeeStorage()
      .delete(doc.storageKey)
      .catch((error: unknown) =>
        console.error(
          "[employee-documents] file removal failed:",
          error instanceof Error ? error.message : error
        )
      );

    revalidatePath(`/admin/employees/${employeeId}`);
    return { success: "Document deleted successfully." };
  } catch (error) {
    console.error("[employee-documents] delete failed:", error instanceof Error ? error.message : error);
    return { error: "Failed to delete document." };
  }
}
