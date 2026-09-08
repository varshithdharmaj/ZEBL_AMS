import type { LeaveBalanceImportRow } from "./types";

export type LeaveBalanceImportRowStatus = "valid" | "no_change" | "warning" | "error" | "duplicate";

export type LeaveBalanceValues = { el: number | null; cl: number | null; sl: number | null };

export type LeaveBalanceImportPreviewRow = {
  rowIndex: number;
  employeeCode: string;
  employeeName: string | null;
  current: LeaveBalanceValues;
  target: LeaveBalanceValues;
  delta: LeaveBalanceValues;
  reason: string;
  status: LeaveBalanceImportRowStatus;
  messages: string[];
  /** True when this row is eligible to be applied on confirm. */
  importable: boolean;
};

export type LeaveBalanceImportIssue = {
  code: string;
  message: string;
  rowIndex?: number;
  employeeCode?: string;
};

export type LeaveBalanceImportPreviewSummary = {
  totalRows: number;
  validRows: number;
  noChangeRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  importableRows: number;
};

export type LeaveBalanceImportPreview = {
  previewId: string;
  meta: { fileName: string; fileSize: number };
  rows: LeaveBalanceImportPreviewRow[];
  summary: LeaveBalanceImportPreviewSummary;
  errors: LeaveBalanceImportIssue[];
  warnings: LeaveBalanceImportIssue[];
  /** Blocking errors prevent Confirm Import. */
  canConfirm: boolean;
};

/** Server-only cached payload (raw rows re-validated at commit, not trusted from preview). */
export type LeaveBalanceImportCacheEntry = {
  previewId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  fileName: string;
  fileSize: number;
  rows: LeaveBalanceImportRow[];
};
