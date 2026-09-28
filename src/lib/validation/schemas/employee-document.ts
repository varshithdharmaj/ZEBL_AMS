import { z } from "zod";
import { EmployeeDocumentType } from "@/generated/prisma/enums";

/** Metadata validated after file bytes are received server-side. */
export const uploadEmployeeDocumentMetaSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  documentType: z.nativeEnum(EmployeeDocumentType),
  fileName: z.string().trim().min(1, "File name is required."),
  mimeType: z.string().trim().min(1, "MIME type is required."),
  sizeBytes: z.number().int().positive("File size must be positive."),
  checksum: z.string().trim().min(1, "Checksum is required."),
});

export const employeeDocumentIdSchema = z.object({
  id: z.string().trim().min(1, "Document ID is required."),
  employeeId: z.coerce.number().int().positive(),
});
