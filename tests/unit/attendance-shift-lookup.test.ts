import { describe, expect, it } from "vitest";
import { isLateCheckIn } from "@/lib/attendance/shift-lookup";
import type { ShiftSummary } from "@/lib/shifts";

const morningShift: ShiftSummary = {
  id: 1,
  name: "Morning Shift",
  startTime: "09:00",
  endTime: "18:00",
  graceMinutes: 10,
  expectedWorkMinutes: 480,
  isActive: true,
};

const nightShift: ShiftSummary = {
  id: 2,
  name: "Night Shift",
  startTime: "20:00",
  endTime: "05:00",
  graceMinutes: 10,
  expectedWorkMinutes: 480,
  isActive: true,
};

describe("isLateCheckIn", () => {
  it("is false with no check-in", () => {
    expect(isLateCheckIn(null, morningShift)).toBe(false);
  });

  it("is false with no shift assigned", () => {
    expect(isLateCheckIn("09:30", null)).toBe(false);
  });

  it("is false exactly at shift start", () => {
    expect(isLateCheckIn("09:00", morningShift)).toBe(false);
  });

  it("is false within the grace window", () => {
    expect(isLateCheckIn("09:10", morningShift)).toBe(false);
  });

  it("is true one minute past the grace window", () => {
    expect(isLateCheckIn("09:11", morningShift)).toBe(true);
  });

  it("is false for an early arrival", () => {
    expect(isLateCheckIn("08:45", morningShift)).toBe(false);
  });

  it("works for a shift starting in the evening, judged against its own start time", () => {
    expect(isLateCheckIn("20:05", nightShift)).toBe(false);
    expect(isLateCheckIn("20:15", nightShift)).toBe(true);
  });
});
