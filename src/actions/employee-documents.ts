"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { prisma } from "@/lib/prisma";
import { requireManageEmployeeSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  employeeDocumentIdSchema,
  uploadEmployeeDocumentMetaSchema,
} from "@/lib/validation/schemas/employee-document";
import { buildEmployeeDocumentStorageKey } from "@/lib/recruitment/shared/storage-paths";
import { getEmployeeStorage } from "@/lib/recruitment/storage/employee-storage";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import { EmployeeDocumentType } from "@/generated/prisma/enums";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function checksumBuffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function assertValidUploadFile(fileName: string, mimeType: string, sizeBytes: number): string | null {
  if (sizeBytes > MAX_FILE_SIZE) {
    return "File size exceeds the maximum limit of 15MB.";
  }
  const lowerFileName = fileName.toLowerCase();
  const mime = mimeType.trim().toLowerCase();
  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext));
  const mimeOk = ALLOWED_MIMES.includes(mime) || mime === "application/octet-stream";
  if (!hasAllowedExt || !mimeOk) {
    return "File type is not allowed. Supported formats: PDF, DOC, DOCX, JPG, PNG, WEBP.";
  }
  return null;
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

    const validationError = assertValidUploadFile(data.fileName, data.mimeType, data.sizeBytes);
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
  } catch {
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

    revalidatePath(`/admin/employees/${employeeId}`);
    return { success: "Document deleted successfully." };
  } catch {
    return { error: "Failed to delete document." };
  }
}
