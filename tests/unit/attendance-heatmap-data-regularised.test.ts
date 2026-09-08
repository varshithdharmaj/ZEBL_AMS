import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEmployeeAttendanceHeatmapData } from "@/lib/attendance/heatmap-data";

// Regression test for a bug where the heatmap dropped `activeRegularizationId`
// (and `remarksSystemGenerated`) when mapping raw DB rows into the classifier
// input, so an HR-approved regularised day silently classified as an ordinary
// PRESENT/WORKED_ON_* day on the heatmap — wrong category, wrong tier tag, and
// wrong cell color — even though the History table classified the same day
// correctly.

const attendanceDate = new Date(2026, 6, 15);

vi.mock("@/lib/attendance/attendance-settings", () => ({
  getAttendanceSettings: vi.fn().mockResolvedValue({
    expectedWorkMinutes: 480,
    weeklyOffDays: [0],
  }),
  getDateOverridesForRange: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/leave/leave-calendar", () => ({
  getHolidaysForRange: vi.fn().mockResolvedValue([]),
  getApprovedLeaveForEmployeeRange: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/attendance/shift-lookup", () => ({
  resolveEmployeeShift: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/attendance/employee-attendance-year-cache", () => ({
  getEmployeeAttendanceRecordsForRange: vi.fn().mockResolvedValue([
    {
      attendanceDate: new Date(2026, 6, 15),
      checkIn: "09:00",
      checkOut: "16:00",
      workedMinutes: 420,
      overtimeMinutes: 0,
      remarks: "HR Regularised",
      remarksSystemGenerated: true,
      activeRegularizationId: 501,
    },
  ]),
}));

describe("getEmployeeAttendanceHeatmapData", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 6, 20));
  });

  it("classifies an HR-regularised day as REGULARISED, not PRESENT", async () => {
    const month = await getEmployeeAttendanceHeatmapData(1);
    const day = month.days.find((d) => d.date.getTime() === attendanceDate.getTime());

    expect(day).toBeDefined();
    expect(day!.category).toBe("REGULARISED");
  });
});
