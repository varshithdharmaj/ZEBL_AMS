export const LEAVE_BALANCE_IMPORT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const LEAVE_BALANCE_IMPORT_MAX_ROWS = 1000;

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/octet-stream",
  "",
]);

function extensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

export type LeaveBalanceFileValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Validate upload by extension, MIME (when present), and size. Content itself is validated at parse time. */
export function validateLeaveBalanceImportFile(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): LeaveBalanceFileValidationResult {
  if (input.size === 0) {
    return { ok: false, error: "Please select an Excel (.xlsx/.xls) or CSV file." };
  }
  if (input.size > LEAVE_BALANCE_IMPORT_MAX_FILE_SIZE) {
    return { ok: false, error: "File size exceeds 5MB limit." };
  }

  const ext = extensionOf(input.fileName);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, error: "Only .xlsx, .xls, or .csv files are allowed." };
  }

  const mime = (input.mimeType ?? "").toLowerCase().trim();
  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false, error: "Invalid file type. Please upload a valid .xlsx, .xls, or .csv file." };
  }

  return { ok: true };
}
