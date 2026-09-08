import * as XLSX from "xlsx";
import type { LeaveBalanceImportParseResult, LeaveBalanceImportRow } from "./types";

const EXPECTED_HEADERS = ["employeecode", "el", "cl", "sl", "reason"] as const;
const MAX_HEADER_SCAN_ROWS = 10;

function rowHasAnyValue(row: unknown[]): boolean {
  return row.some((cell) => String(cell ?? "").trim().length > 0);
}

function normalizeHeader(cell: unknown): string {
  return String(cell ?? "").trim().toLowerCase();
}

/** Non-blank + valid non-negative number -> the number; blank -> null; non-blank + invalid -> "invalid". */
function parseOptionalBalanceCell(cell: unknown): number | null | "invalid" {
  const raw = String(cell ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0) return "invalid";
  return value;
}

function findHeaderRow(rows: unknown[][]): { index: number; columns: Record<string, number> } | null {
  const limit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    if (!rowHasAnyValue(row)) continue;
    const normalized = row.map(normalizeHeader);
    const hasEmployeeCode = normalized.includes("employeecode");
    if (!hasEmployeeCode) continue;

    const columns: Record<string, number> = {};
    for (const header of EXPECTED_HEADERS) {
      const idx = normalized.indexOf(header);
      if (idx !== -1) columns[header] = idx;
    }
    return { index: i, columns };
  }
  return null;
}

function parseRows(rows: unknown[][]): LeaveBalanceImportParseResult {
  if (rows.length === 0 || !rows.some(rowHasAnyValue)) {
    return { ok: false, error: "File has no data rows." };
  }

  const header = findHeaderRow(rows);
  if (!header) {
    return {
      ok: false,
      error:
        "File has no recognizable header row. Expected columns: employeeCode, el, cl, sl, reason (employeeCode is required).",
    };
  }

  const dataRows = rows.slice(header.index + 1);
  const parsed: LeaveBalanceImportRow[] = [];

  dataRows.forEach((row, offset) => {
    if (!rowHasAnyValue(row)) return;

    const employeeCode = String(row[header.columns.employeecode] ?? "").trim();
    if (!employeeCode) return;

    const invalidColumns: ("el" | "cl" | "sl")[] = [];
    const readBalance = (key: "el" | "cl" | "sl"): number | null => {
      if (!(key in header.columns)) return null;
      const result = parseOptionalBalanceCell(row[header.columns[key]]);
      if (result === "invalid") {
        invalidColumns.push(key);
        return null;
      }
      return result;
    };

    const el = readBalance("el");
    const cl = readBalance("cl");
    const sl = readBalance("sl");
    const reasonRaw = "reason" in header.columns ? String(row[header.columns.reason] ?? "").trim() : "";

    parsed.push({
      rowIndex: header.index + 1 + offset + 1, // 1-based, counting the header row
      employeeCode,
      el,
      cl,
      sl,
      reason: reasonRaw || null,
      invalidColumns,
    });
  });

  if (parsed.length === 0) {
    return { ok: false, error: "No valid rows found — check that employeeCode is filled on data rows." };
  }

  return { ok: true, rows: parsed };
}

/** Parses an Excel (.xlsx/.xls) or CSV buffer using the xlsx package (handles both formats). */
export function parseLeaveBalanceImportFile(buffer: Buffer): LeaveBalanceImportParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    if (!workbook.SheetNames.length) {
      return { ok: false, error: "File has no sheets." };
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
    return parseRows(rows);
  } catch {
    return { ok: false, error: "Failed to process the file. Please check the format." };
  }
}
