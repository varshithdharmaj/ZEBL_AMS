import { prisma } from "@/lib/prisma";
import { isTerminalEmployeeStatus } from "@/lib/people-scope/terminal-statuses";
import type { LeaveBalanceImportRow } from "./types";
import type {
  LeaveBalanceImportIssue,
  LeaveBalanceImportPreview,
  LeaveBalanceImportPreviewRow,
  LeaveBalanceValues,
} from "./preview-types";

const DEFAULT_REASON = "Excel migration — opening balance";

export async function buildLeaveBalanceImportPreview(params: {
  previewId: string;
  fileName: string;
  fileSize: number;
  rows: LeaveBalanceImportRow[];
}): Promise<LeaveBalanceImportPreview> {
  const { previewId, fileName, fileSize, rows } = params;

  const codes = [...new Set(rows.map((r) => r.employeeCode))];
  const employees = await prisma.employee.findMany({
    where: { employeeCode: { in: codes } },
    include: { leaveBalance: true },
  });
  const byCode = new Map(employees.map((e) => [e.employeeCode, e]));

  const seenCodes = new Set<string>();
  const previewRows: LeaveBalanceImportPreviewRow[] = [];
  const errors: LeaveBalanceImportIssue[] = [];
  const warnings: LeaveBalanceImportIssue[] = [];

  for (const row of rows) {
    const messages: string[] = [];
    let status: LeaveBalanceImportPreviewRow["status"] = "valid";

    for (const col of row.invalidColumns) {
      messages.push(`Invalid ${col.toUpperCase()} value — must be a non-negative number.`);
    }

    if (seenCodes.has(row.employeeCode)) {
      status = "duplicate";
      messages.push(`Duplicate employeeCode "${row.employeeCode}" in file — only the first occurrence is applied.`);
    }
    seenCodes.add(row.employeeCode);

    const employee = byCode.get(row.employeeCode);
    if (!employee) {
      status = "error";
      const msg = `Unknown employee code "${row.employeeCode}" — employee must already exist before importing an opening balance.`;
      messages.push(msg);
      errors.push({ code: "unknown_employee", message: msg, rowIndex: row.rowIndex, employeeCode: row.employeeCode });
    } else if (isTerminalEmployeeStatus(employee.employeeStatus)) {
      status = "error";
      const msg = `Employee "${row.employeeCode}" is not active (${employee.employeeStatus}).`;
      messages.push(msg);
      errors.push({ code: "inactive_employee", message: msg, rowIndex: row.rowIndex, employeeCode: row.employeeCode });
    }

    if (row.invalidColumns.length > 0 && status !== "error") {
      status = "error";
      errors.push({
        code: "invalid_value",
        message: messages[0],
        rowIndex: row.rowIndex,
        employeeCode: row.employeeCode,
      });
    }

    const current: LeaveBalanceValues = {
      el: employee?.leaveBalance?.elBalance ?? null,
      cl: employee?.leaveBalance?.clBalance ?? null,
      sl: employee?.leaveBalance?.slBalance ?? null,
    };
    const target: LeaveBalanceValues = { el: row.el, cl: row.cl, sl: row.sl };
    const delta: LeaveBalanceValues = {
      el: row.el != null && current.el != null ? row.el - current.el : null,
      cl: row.cl != null && current.cl != null ? row.cl - current.cl : null,
      sl: row.sl != null && current.sl != null ? row.sl - current.sl : null,
    };

    const anyDelta = [delta.el, delta.cl, delta.sl].some((d) => d != null && d !== 0);
    const anyTarget = [row.el, row.cl, row.sl].some((v) => v != null);

    if (status === "valid") {
      if (!anyTarget || !anyDelta) {
        status = "no_change";
      } else {
        const overwritesNonZero =
          (delta.el != null && delta.el !== 0 && (current.el ?? 0) !== 0) ||
          (delta.cl != null && delta.cl !== 0 && (current.cl ?? 0) !== 0) ||
          (delta.sl != null && delta.sl !== 0 && (current.sl ?? 0) !== 0);
        if (overwritesNonZero) {
          status = "warning";
          const msg = `Will overwrite an existing non-zero balance for "${row.employeeCode}".`;
          messages.push(msg);
          warnings.push({ code: "overwrite", message: msg, rowIndex: row.rowIndex, employeeCode: row.employeeCode });
        }
      }
    }

    const importable = status === "valid" || status === "warning";

    previewRows.push({
      rowIndex: row.rowIndex,
      employeeCode: row.employeeCode,
      employeeName: employee?.name ?? null,
      current,
      target,
      delta,
      reason: row.reason?.trim() || DEFAULT_REASON,
      status,
      messages,
      importable,
    });
  }

  const summary = {
    totalRows: previewRows.length,
    validRows: previewRows.filter((r) => r.status === "valid").length,
    noChangeRows: previewRows.filter((r) => r.status === "no_change").length,
    warningRows: previewRows.filter((r) => r.status === "warning").length,
    errorRows: previewRows.filter((r) => r.status === "error").length,
    duplicateRows: previewRows.filter((r) => r.status === "duplicate").length,
    importableRows: previewRows.filter((r) => r.importable).length,
  };

  return {
    previewId,
    meta: { fileName, fileSize },
    rows: previewRows,
    summary,
    errors,
    warnings,
    canConfirm: summary.errorRows === 0,
  };
}
