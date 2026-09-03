import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_IMPORT_PARSER_VERSION,
  IMPORT_CHUNK_SIZE,
  compressPayload,
  decompressPayload,
} from "@/lib/attendance/import/import-job-payload";
import type { AttendanceImportRow } from "@/lib/attendance/import/types";
import { importAttendanceRowBatch } from "@/lib/attendance/import/import-batch";

function sampleRow(partial?: Partial<AttendanceImportRow>): AttendanceImportRow {
  return {
    employeeCode: partial?.employeeCode ?? "660005",
    employeeName: partial?.employeeName ?? "Madhukar",
    shift: partial?.shift ?? "GS",
    inTime: partial?.inTime ?? "09:00",
    outTime: partial?.outTime ?? "18:00",
    workDuration: partial?.workDuration ?? "09:00",
    ot: partial?.ot ?? "0",
    status: partial?.status ?? "Present",
    remarks: partial?.remarks ?? "",
    attendanceDate: partial?.attendanceDate,
    source: partial?.source ?? "PDF_DAILY",
  };
}

/**
 * An Excel time-only cell, as SheetJS represents it with `cellDates: true`:
 * a JS Date anchored to the 1899-12-30 "day zero" epoch plus the time-of-day,
 * constructed via the *local* Date constructor (verified empirically against
 * the real `xlsx` package — SheetJS builds these so that `.getHours()`/
 * `.getMinutes()` recover the Excel-displayed time in any environment
 * timezone). Using the local constructor here — not `Date.UTC` — is what
 * makes this test match real SheetJS output and pass regardless of the
 * machine's timezone. This is the exact shape that reached `serializeRow`
 * for the 39 rows corrupted in production upload #12 (2026-08-12).
 */
function excelEpochTime(hours: number, minutes: number, seconds = 0, ms = 0): Date {
  return new Date(1899, 11, 30, hours, minutes, seconds, ms);
}

/** Minimal fake Prisma transaction client covering only what importAttendanceRowBatch calls. */
function makeFakeTx() {
  const employees = new Map<string, { id: number; employeeCode: string; name: string }>();
  const attendanceRecords: Array<Record<string, unknown>> = [];
  const attendanceSessions: Array<Record<string, unknown>> = [];
  let nextId = 1;

  const tx = {
    employee: {
      findMany: async ({ where }: { where: { employeeCode: { in: string[] } } }) =>
        where.employeeCode.in
          .map((code) => employees.get(code))
          .filter((e): e is { id: number; employeeCode: string; name: string } => !!e),
      create: async ({ data }: { data: { employeeCode: string; name: string } }) => {
        const emp = { id: nextId++, employeeCode: data.employeeCode, name: data.name };
        employees.set(data.employeeCode, emp);
        return emp;
      },
    },
    attendanceRecord: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const record = { id: nextId++, ...data };
        attendanceRecords.push(record);
        return record;
      },
    },
    attendanceSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const session = { id: nextId++, ...data };
        attendanceSessions.push(session);
        return session;
      },
    },
  };

  return { tx: tx as unknown as Parameters<typeof importAttendanceRowBatch>[0], attendanceRecords, attendanceSessions };
}

describe("import-job-payload", () => {
  it("exposes chunk size 15 and parser version", () => {
    expect(IMPORT_CHUNK_SIZE).toBe(15);
    expect(ATTENDANCE_IMPORT_PARSER_VERSION).toBe("2");
  });

  it("round-trips rows including attendance dates", () => {
    const date = new Date("2026-07-29T00:00:00.000Z");
    const rows = [
      sampleRow({ attendanceDate: date }),
      sampleRow({ employeeCode: "GHOST", attendanceDate: undefined }),
    ];
    const compressed = compressPayload(rows);
    expect(compressed).toBeInstanceOf(Uint8Array);
    expect(compressed.byteLength).toBeGreaterThan(0);

    const restored = decompressPayload(compressed);
    expect(restored).toHaveLength(2);
    expect(restored[0].employeeCode).toBe("660005");
    expect(restored[0].attendanceDate).toBeInstanceOf(Date);
    expect(restored[0].attendanceDate!.toISOString()).toBe(date.toISOString());
    expect(restored[1].attendanceDate).toBeUndefined();
  });

  describe("inTime/outTime canonicalization", () => {
    it("(A) canonicalizes Date-typed Excel time-only cells to HH:mm, not the 1899-12-30 epoch string", () => {
      const rows = [
        sampleRow({
          inTime: excelEpochTime(19, 32, 52, 973),
          outTime: excelEpochTime(5, 12, 31, 997),
        }),
      ];

      const restored = decompressPayload(compressPayload(rows));

      expect(restored[0].inTime).toBe("19:32");
      expect(restored[0].outTime).toBe("05:12");
      expect(String(restored[0].inTime)).not.toMatch(/1899-12-30/);
      expect(String(restored[0].outTime)).not.toMatch(/1899-12-30/);
    });

    it("(B) leaves normal HH:mm string values unchanged", () => {
      const rows = [sampleRow({ inTime: "19:32", outTime: "05:12" })];
      const restored = decompressPayload(compressPayload(rows));
      expect(restored[0].inTime).toBe("19:32");
      expect(restored[0].outTime).toBe("05:12");
    });

    it("(C) preserves numeric Excel time-fraction values as HH:mm", () => {
      // 19:32 as an Excel day-fraction: (19*60+32)/1440
      const rows = [sampleRow({ inTime: 1172 / 1440, outTime: 312 / 1440 })];
      const restored = decompressPayload(compressPayload(rows));
      expect(restored[0].inTime).toBe("19:32");
      expect(restored[0].outTime).toBe("05:12");
    });

    it("(D) keeps null/empty check-in/check-out as null", () => {
      // Bypass sampleRow's `??` defaulting so `null`/`undefined` reach serializeRow as-is.
      const rows = [{ ...sampleRow(), inTime: null, outTime: undefined }];
      const restored = decompressPayload(compressPayload(rows));
      expect(restored[0].inTime).toBeNull();
      expect(restored[0].outTime).toBeNull();
    });

    it("(E) round-trips Excel-epoch Date cells through job compression AND the import batch write as canonical HH:mm", async () => {
      const rows = [
        sampleRow({
          employeeCode: "E900",
          inTime: excelEpochTime(19, 32),
          outTime: excelEpochTime(5, 12),
          workDuration: "09:40",
        }),
      ];

      // Excel row -> parse (simulated by sampleRow's Date cells) -> serialize -> JSON -> decompress
      const jsonRows = decompressPayload(compressPayload(rows));

      // -> import batch (the actual DB-write path used by the chunked job processor)
      const { tx, attendanceRecords, attendanceSessions } = makeFakeTx();
      await importAttendanceRowBatch(tx, {
        rows: jsonRows,
        formAttendanceDate: new Date("2026-08-12T00:00:00.000Z"),
        uploadId: 1,
      });

      expect(attendanceRecords).toHaveLength(1);
      expect(attendanceRecords[0].checkIn).toBe("19:32");
      expect(attendanceRecords[0].checkOut).toBe("05:12");
      expect(attendanceSessions).toHaveLength(1);
      expect(attendanceSessions[0].checkIn).toBe("19:32");
      expect(attendanceSessions[0].checkOut).toBe("05:12");
    });

    it("(F) regression: the exact historical corruption pattern (1899-12-30T19:32:52.973Z) can no longer be produced", async () => {
      // This is the exact class of value found in production attendance_records
      // for upload_id=12 (2026-08-12): a JS Date for a time-only Excel cell,
      // anchored to the Excel epoch, arriving at serializeRow as `unknown`.
      // Built via the local constructor (matching real SheetJS output, per
      // excelEpochTime above) — a raw `new Date("1899-12-30T19:32:52.973Z")`
      // would itself already be the corrupted string re-parsed, which is not
      // what the pipeline ever actually receives.
      const corruptingDate = excelEpochTime(19, 32, 52, 973);
      const rows = [{ ...sampleRow({ employeeCode: "E901" }), inTime: corruptingDate, outTime: null }];

      const jsonRows = decompressPayload(compressPayload(rows));
      expect(jsonRows[0].inTime).toBe("19:32");
      expect(jsonRows[0].inTime).not.toBe("1899-12-30T19:32:52.973Z");

      const { tx, attendanceRecords } = makeFakeTx();
      await importAttendanceRowBatch(tx, {
        rows: jsonRows,
        formAttendanceDate: new Date("2026-08-12T00:00:00.000Z"),
        uploadId: 1,
      });

      expect(attendanceRecords[0].checkIn).toBe("19:32");
      expect(String(attendanceRecords[0].checkIn)).not.toMatch(/1899-12-30/);
      expect(String(attendanceRecords[0].checkIn)).not.toMatch(/T\d{2}:\d{2}:\d{2}/);
    });
  });
});
