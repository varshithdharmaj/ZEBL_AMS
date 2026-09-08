import { describe, expect, it, vi } from "vitest";

const getHolidaysForRange = vi.fn();
const getApprovedLeaveForEmployeeRange = vi.fn();
const getAttendanceSettings = vi.fn();
const getDateOverridesForRange = vi.fn();
const resolveEmployeeShift = vi.fn();

vi.mock("@/lib/leave/leave-calendar", () => ({
  getHolidaysForRange: (...args: unknown[]) => getHolidaysForRange(...args),
  getApprovedLeaveForEmployeeRange: (...args: unknown[]) => getApprovedLeaveForEmployeeRange(...args),
}));

vi.mock("@/lib/attendance/attendance-settings", () => ({
  getAttendanceSettings: (...args: unknown[]) => getAttendanceSettings(...args),
  getDateOverridesForRange: (...args: unknown[]) => getDateOverridesForRange(...args),
}));

vi.mock("@/lib/attendance/shift-lookup", () => ({
  resolveEmployeeShift: (...args: unknown[]) => resolveEmployeeShift(...args),
  isLateCheckIn: (checkIn: string | null, shift: { startTime: string; graceMinutes: number } | null) => {
    if (!checkIn || !shift) return false;
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    return toMin(checkIn) > toMin(shift.startTime) + shift.graceMinutes;
  },
}));

import { classifyAttendanceRecords, dateSpanOf, type AttendanceHistoryRecordInput } from "@/lib/attendance/history-classification";

// `status` is the legacy field kept only for the admin employee-profile tab (see the
// history-classification.ts comment) — irrelevant to every test below, which exercises
// the canonical classifier, so it's defaulted here rather than repeated per fixture.
function rec(overrides: Partial<AttendanceHistoryRecordInput> & Pick<AttendanceHistoryRecordInput, "id" | "attendanceDate">): AttendanceHistoryRecordInput {
  return {
    checkIn: null,
    checkOut: null,
    workedMinutes: 0,
    overtimeMinutes: 0,
    remarks: null,
    status: "Present",
    ...overrides,
  };
}

const schedule = {
  mondayWorking: true,
  tuesdayWorking: true,
  wednesdayWorking: true,
  thursdayWorking: true,
  fridayWorking: true,
  saturdayWorking: false,
  sundayWorking: false,
  expectedWorkMinutes: 480,
};

function setupLookups(overrides: {
  holidays?: unknown[];
  leave?: unknown[];
  dateOverrides?: unknown[];
} = {}) {
  getHolidaysForRange.mockResolvedValue(overrides.holidays ?? []);
  getApprovedLeaveForEmployeeRange.mockResolvedValue(overrides.leave ?? []);
  getAttendanceSettings.mockResolvedValue(schedule);
  getDateOverridesForRange.mockResolvedValue(overrides.dateOverrides ?? []);
  resolveEmployeeShift.mockResolvedValue(null);
}

// 2026-07-20 = Monday (working by default per `schedule`).
const monday = new Date(2026, 6, 20);
const sunday = new Date(2026, 6, 19);

describe("classifyAttendanceRecords", () => {
  it("returns an empty array without querying anything when there are no records", async () => {
    setupLookups();
    const result = await classifyAttendanceRecords(1, [], monday, monday);
    expect(result).toEqual([]);
    expect(getHolidaysForRange).not.toHaveBeenCalled();
  });

  it("reclassifies a day marked 'Absent' by the raw status as LEAVE when approved leave covers it — the core bug this module fixes", async () => {
    setupLookups({ leave: [{ leaveType: "SL", startDate: monday, endDate: monday }] });
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 1, attendanceDate: monday, remarks: "marked absent by upload, later approved as sick leave" })],
      monday,
      monday
    );
    expect(result.category).toBe("LEAVE");
  });

  it("classifies a normal present day using the canonical ratio tiers", async () => {
    setupLookups();
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 2, attendanceDate: monday, checkIn: "09:00", checkOut: "18:00", workedMinutes: 480 })],
      monday,
      monday
    );
    expect(result.category).toBe("PRESENT");
    expect(result.ratioTier).toBe("target");
    expect(result.expectedWorkMinutes).toBe(480);
  });

  it("flags late arrival and early checkout from remarks, same detection hero-status.ts uses", async () => {
    setupLookups();
    const [late, early] = await classifyAttendanceRecords(
      1,
      [
        rec({
          id: 3,
          attendanceDate: monday,
          checkIn: "09:45",
          checkOut: "18:00",
          workedMinutes: 495,
          remarks: "Late arrival, approved by manager",
        }),
        rec({
          id: 4,
          attendanceDate: monday,
          checkIn: "09:00",
          checkOut: "16:00",
          workedMinutes: 420,
          remarks: "Early checkout for appointment",
        }),
      ],
      monday,
      monday
    );
    expect(late.late).toBe(true);
    expect(late.earlyCheckout).toBe(false);
    expect(early.earlyCheckout).toBe(true);
    expect(early.late).toBe(false);
  });

  it("classifies a Sunday with a punch as WORKED_ON_WEEKLY_OFF, not plain Present", async () => {
    setupLookups();
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 5, attendanceDate: sunday, checkIn: "10:00", checkOut: "14:00", workedMinutes: 240, overtimeMinutes: 240 })],
      sunday,
      sunday
    );
    expect(result.category).toBe("WORKED_ON_WEEKLY_OFF");
  });

  it("classifies a check-in with no checkout and zero worked minutes as INSUFFICIENT_DATA, not Short Hours", async () => {
    setupLookups();
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 6, attendanceDate: monday, checkIn: "09:00", remarks: "missing checkout" })],
      monday,
      monday
    );
    expect(result.category).toBe("INSUFFICIENT_DATA");
  });

  it("uses the employee's assigned shift's expectedWorkMinutes instead of the org-wide default", async () => {
    setupLookups();
    resolveEmployeeShift.mockResolvedValue({
      id: 1,
      name: "Night Shift",
      startTime: "20:00",
      endTime: "05:00",
      graceMinutes: 10,
      expectedWorkMinutes: 420,
      isActive: true,
    });
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 9, attendanceDate: monday, checkIn: "20:00", checkOut: "03:00", workedMinutes: 420 })],
      monday,
      monday
    );
    expect(result.expectedWorkMinutes).toBe(420);
    expect(result.ratioTier).toBe("target");
  });

  it("flags late arrival from real shift timing (start + grace), overriding the remark heuristic, when a shift is assigned", async () => {
    setupLookups();
    resolveEmployeeShift.mockResolvedValue({
      id: 1,
      name: "Morning Shift",
      startTime: "09:00",
      endTime: "18:00",
      graceMinutes: 10,
      expectedWorkMinutes: 480,
      isActive: true,
    });
    const [onTime, late] = await classifyAttendanceRecords(
      1,
      [
        rec({ id: 10, attendanceDate: monday, checkIn: "09:09", checkOut: "18:00", workedMinutes: 471, remarks: "late arrival noted" }),
        rec({ id: 11, attendanceDate: monday, checkIn: "09:11", checkOut: "18:00", workedMinutes: 469 }),
      ],
      monday,
      monday
    );
    // Within grace despite a misleading remark — real shift timing wins.
    expect(onTime.late).toBe(false);
    // Past grace with no remark at all — still caught because it's computed, not text-matched.
    expect(late.late).toBe(true);
  });

  it("matches each record to its own date's holiday/leave/override, not a neighbor's", async () => {
    const tuesday = new Date(2026, 6, 21);
    setupLookups({
      holidays: [{ name: "Founders Day", holidayDate: monday }],
    });
    const [mondayResult, tuesdayResult] = await classifyAttendanceRecords(
      1,
      [rec({ id: 7, attendanceDate: monday }), rec({ id: 8, attendanceDate: tuesday })],
      monday,
      tuesday
    );
    expect(mondayResult.category).toBe("HOLIDAY");
    expect(tuesdayResult.category).toBe("ABSENT");
  });
});

describe("dateSpanOf", () => {
  it("returns the min and max attendanceDate across records", () => {
    const a = new Date(2026, 5, 1);
    const b = new Date(2026, 5, 15);
    const c = new Date(2026, 5, 8);
    const { start, end } = dateSpanOf([{ attendanceDate: a }, { attendanceDate: b }, { attendanceDate: c }]);
    expect(start.getTime()).toBe(a.getTime());
    expect(end.getTime()).toBe(b.getTime());
  });
});
