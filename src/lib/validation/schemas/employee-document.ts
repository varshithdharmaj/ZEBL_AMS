import { z } from "zod";
import { EmployeeDocumentType } from "@/generated/prisma/enums";

export const EMPLOYEE_DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  PAN_CARD: "PAN card",
  AADHAAR_CARD: "Aadhaar card",
  PASSPORT: "Passport",
  BANK_PROOF: "Bank proof",
  OFFER_LETTER: "Offer letter",
  EDUCATION_CERTIFICATE: "Education certificate",
  RELIEVING_LETTER: "Relieving letter",
  OTHER: "Other",
};

/**
 * Uploads go through a Server Action, so the file must fit under next.config's
 * serverActions.bodySizeLimit (5mb) and Vercel's 4.5 MB request cap.
 */
export const EMPLOYEE_DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const EMPLOYEE_DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

const ALLOWED_EXTENSIONS = EMPLOYEE_DOCUMENT_ACCEPT.split(",");
const ALLOWED_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Shared by the upload form (before sending) and the server action. Returns an error message or null. */
export function checkEmployeeDocumentFile(fileName: string, mimeType: string, sizeBytes: number): string | null {
  if (sizeBytes > EMPLOYEE_DOCUMENT_MAX_BYTES) {
    return `File size exceeds the maximum limit of ${EMPLOYEE_DOCUMENT_MAX_BYTES / (1024 * 1024)}MB.`;
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
