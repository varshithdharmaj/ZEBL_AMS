import { gunzipSync, gzipSync } from "node:zlib";
import { formatTimeCell } from "./cell-utils";
import type { AttendanceImportRow, AttendanceReportType } from "./types";

/** Rows processed per committed DB transaction during job import. */
export const IMPORT_CHUNK_SIZE = 15;

/**
 * Bump when serialized row shape changes.
 * v2: inTime/outTime are canonicalized to "HH:mm" strings before JSON serialization
 * (previously passed through raw, which let JS Date cells for Excel time-only values
 * survive JSON.stringify as ISO strings anchored to the 1899-12-30 epoch).
 */
export const ATTENDANCE_IMPORT_PARSER_VERSION = "2";

type SerializedImportRow = Omit<AttendanceImportRow, "attendanceDate" | "source" | "inTime" | "outTime"> & {
  attendanceDate?: string;
  source: AttendanceReportType;
  inTime: string | null;
  outTime: string | null;
};

type PayloadEnvelope = {
  version: string;
  rows: SerializedImportRow[];
};

/**
 * Canonicalize inTime/outTime to "HH:mm" (or null) *before* they cross the JSON
 * serialization boundary. `AttendanceImportRow.inTime`/`outTime` are `unknown` and may
 * still be a JS `Date` at this point (SheetJS represents an Excel time-only cell as a
 * Date anchored to the 1899-12-30 epoch). JSON has no Date type — JSON.stringify would
 * silently rewrite such a Date as its ISO string via `Date.prototype.toJSON()`, and
 * nothing on the read side would know to reconstruct it. Canonicalizing here means the
 * payload only ever carries a plain string (or null), so no Date-identity assumption is
 * needed on deserialize.
 */
function serializeRow(row: AttendanceImportRow): SerializedImportRow {
  return {
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    shift: row.shift,
    inTime: formatTimeCell(row.inTime),
    outTime: formatTimeCell(row.outTime),
    workDuration: row.workDuration,
    ot: row.ot,
    status: row.status,
    remarks: row.remarks,
    source: row.source,
    ...(row.attendanceDate instanceof Date && !Number.isNaN(row.attendanceDate.getTime())
      ? { attendanceDate: row.attendanceDate.toISOString() }
      : {}),
  };
}

function deserializeRow(row: SerializedImportRow): AttendanceImportRow {
  const attendanceDate =
    typeof row.attendanceDate === "string" && row.attendanceDate.length > 0
      ? new Date(row.attendanceDate)
      : undefined;

  return {
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    shift: row.shift,
    inTime: row.inTime,
    outTime: row.outTime,
    workDuration: row.workDuration,
    ot: row.ot,
    status: row.status,
    remarks: row.remarks,
    source: row.source,
    ...(attendanceDate && !Number.isNaN(attendanceDate.getTime())
      ? { attendanceDate }
      : {}),
  };
}

/**
 * Compress parsed import rows for durable job storage (gzip JSON).
 * Dates are stored as ISO strings.
 */
export function compressPayload(rows: AttendanceImportRow[]): Uint8Array<ArrayBuffer> {
  const envelope: PayloadEnvelope = {
    version: ATTENDANCE_IMPORT_PARSER_VERSION,
    rows: rows.map(serializeRow),
  };
  const gzipped = gzipSync(Buffer.from(JSON.stringify(envelope), "utf8"));
  const bytes = new Uint8Array(gzipped.byteLength);
  bytes.set(gzipped);
  return bytes;
}

/**
 * Decompress a job payload back into typed import rows.
 */
export function decompressPayload(bytes: Uint8Array | Buffer): AttendanceImportRow[] {
  const json = gunzipSync(Buffer.from(bytes)).toString("utf8");
  const parsed = JSON.parse(json) as PayloadEnvelope;
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error("Invalid attendance import payload.");
  }
  return parsed.rows.map(deserializeRow);
}
