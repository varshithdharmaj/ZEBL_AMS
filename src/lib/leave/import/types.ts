/** One row of the parsed leave-balance opening-balance import file. */
export type LeaveBalanceImportRow = {
  rowIndex: number;
  employeeCode: string;
  /** null = column left blank = don't touch this leave type for this row. */
  el: number | null;
  cl: number | null;
  sl: number | null;
  reason: string | null;
  /** Column names (el/cl/sl) whose cell had non-blank content that wasn't a valid non-negative number. */
  invalidColumns: ("el" | "cl" | "sl")[];
};

export type LeaveBalanceImportParseResult =
  | { ok: true; rows: LeaveBalanceImportRow[] }
  | { ok: false; error: string };
