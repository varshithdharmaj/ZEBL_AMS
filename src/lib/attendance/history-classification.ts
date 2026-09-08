import type { RegularizationRequestType } from "@/generated/prisma/client";
import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";
import { getEffectiveAttendanceDayType, type AttendanceDayCategory, type AttendanceRatioTier } from "@/lib/attendance/day-classification";
import { hasRemarkKeyword } from "@/lib/attendance/hero-status";
import { resolveEmployeeShift, isLateCheckIn } from "@/lib/attendance/shift-lookup";
import { isSameDay, startOfDay } from "@/lib/utils";

/** The regularisation request currently applied to a day, as selected by callers
 *  (getAttendanceRecords / getEmployeeAttendanceHistory) via the `activeRegularization`
 *  relation — carries the HR-facing provenance detail (reason, review, pre-correction
 *  snapshot) that the classifier itself never needs but consumers of the classified
 *  record (badges, diff views) do. */
export type ActiveRegularizationDetail = {
  reason: string;
  reviewComment: string | null;
  requestType: RegularizationRequestType;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  snapshotBefore: unknown;
  reviewedAt: Date | null;
};

export type AttendanceHistoryRecordInput = {
  id: number;
  attendanceDate: Date;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
  remarks: string | null;
  /** True when `remarks` is an internal/technical tag rather than a human-authored
   *  note. Threaded straight through to the classifier (see day-classification.ts). */
  remarksSystemGenerated?: boolean;
  /** Raw upload-time status, kept only for callers still on the legacy field (e.g. the
   *  admin employee-profile attendance tab) — not used by the canonical classification
   *  below. New consumers should read `category`/`ratioTier` instead. */
  status: string;
  /** AttendanceRecord.activeRegularizationId — non-null when an approved HR correction
   *  governs this day. Threaded straight through to the classifier (see day-classification.ts). */
  activeRegularizationId?: number | null;
  /** Populated only when the caller's Prisma query includes the `activeRegularization`
   *  relation (getAttendanceRecords, getEmployeeAttendanceHistory) — passed through
   *  untouched by classifyAttendanceRecords below (see the `...record` spread). */
  activeRegularization?: ActiveRegularizationDetail | null;
};

export type ClassifiedAttendanceRecord = AttendanceHistoryRecordInput & {
  category: AttendanceDayCategory;
  ratioTier: AttendanceRatioTier | null;
  expectedWorkMinutes: number;
  late: boolean;
  earlyCheckout: boolean;
  hasLeaveConflict: boolean;
};

/**
 * Re-classifies existing attendance rows with the same canonical classifier the Hero,
 * Timeline, and Heatmap already use — instead of the raw upload-time `status` string
 * (Present/Absent/Short Hours only), which has no concept of leave/holiday/weekly-off
 * and so mislabels those days (e.g. an approved-leave day with no punch reads as
 * "Absent"). Only 3 extra range-bounded lookups (holidays/leave/overrides); settings is
 * request-memoized via React's cache() so a second call here is free.
 */
export async function classifyAttendanceRecords(
  employeeId: number,
  records: AttendanceHistoryRecordInput[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<ClassifiedAttendanceRecord[]> {
  if (records.length === 0) return [];

  const [holidays, approvedLeave, settings, overrides, shift] = await Promise.all([
    getHolidaysForRange(rangeStart, rangeEnd),
    getApprovedLeaveForEmployeeRange(employeeId, rangeStart, rangeEnd),
    getAttendanceSettings(),
    getDateOverridesForRange(rangeStart, rangeEnd),
    resolveEmployeeShift(employeeId),
  ]);
  // This employee's assigned shift overrides the org-wide default when set (and still
  // active) — see shift-lookup.ts. Falls back to the global setting when unassigned.
  const expectedWorkMinutes = shift?.expectedWorkMinutes ?? settings.expectedWorkMinutes;

  return records.map((record) => {
    const date = startOfDay(record.attendanceDate);
    const holiday = holidays.find((h) => isSameDay(h.holidayDate, date)) ?? null;
    const leave =
      approvedLeave.find((l) => date >= startOfDay(l.startDate) && date <= startOfDay(l.endDate)) ?? null;
    const override = overrides.find((o) => isSameDay(o.date, date)) ?? null;

    const day = getEffectiveAttendanceDayType({
      date,
      attendanceRecord: {
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        workedMinutes: record.workedMinutes,
        overtimeMinutes: record.overtimeMinutes,
        remarks: record.remarks,
        remarksSystemGenerated: record.remarksSystemGenerated ?? false,
        activeRegularizationId: record.activeRegularizationId ?? null,
      },
      holiday: holiday ? { name: holiday.name } : null,
      approvedLeave: leave ? { leaveType: leave.leaveType } : null,
      weeklySchedule: settings,
      dateOverride: override?.type ?? null,
      expectedWorkMinutes,
    });

    // Imports/regularisation may set an explicit overtimeMinutes; biometric-derived and
    // live check-in records never do (see attendance-sessions.ts / biometric-attendance-
    // derivation.ts, which both persist 0). Fall back to worked-minus-expected so the
    // profile/history OT column reflects real hours instead of always reading 0.
    const overtimeMinutes =
      record.overtimeMinutes > 0
        ? record.overtimeMinutes
        : Math.max(0, record.workedMinutes - expectedWorkMinutes);

    // HR already reviewed and approved this day's times — never surface a late-arrival
    // or early-checkout penalty tag on top of an approved correction, regardless of
    // what the stored remark happens to say.
    const isRegularised = day.category === "REGULARISED";

    // Real shift-timing-based late detection when a shift is assigned; the remark-text
    // heuristic remains the fallback for employees with no shift assigned (or when the
    // assigned shift no longer resolves — see resolveEmployeeShift).
    const late =
      !isRegularised && (shift ? isLateCheckIn(record.checkIn, shift) : hasRemarkKeyword(day.remark, "late"));

    return {
      ...record,
      overtimeMinutes,
      category: day.category,
      ratioTier: day.ratioTier,
      expectedWorkMinutes,
      late,
      earlyCheckout: !isRegularised && hasRemarkKeyword(day.remark, "early"),
      hasLeaveConflict: day.hasLeaveConflict,
    };
  });
}

/** Tight bound for callers with no explicit date filter (e.g. unfiltered pagination) —
 *  avoids fetching holiday/leave/override data for a wider span than the page actually needs. */
export function dateSpanOf(records: { attendanceDate: Date }[]): { start: Date; end: Date } {
  const times = records.map((r) => r.attendanceDate.getTime());
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
}
