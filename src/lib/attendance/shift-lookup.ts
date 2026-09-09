import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { ShiftSummary } from "@/lib/shifts";

/** Request-memoized: every classification call in the same request shares one query. */
export const getShiftMap = cache(async (): Promise<Map<string, ShiftSummary>> => {
  const shifts = await prisma.shift.findMany({ where: { isActive: true } });
  return new Map(shifts.map((s) => [s.name, s]));
});

const getEmployeeShiftName = cache(async (employeeId: number): Promise<string | null> => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { shift: true },
  });
  return employee?.shift ?? null;
});

/**
 * Resolves this employee's assigned Shift row. Returns null when the employee has no
 * shift assigned, or their assigned name no longer matches an active Shift (renamed or
 * deactivated since assignment) — callers fall back to the org-wide default in that case.
 */
export async function resolveEmployeeShift(employeeId: number): Promise<ShiftSummary | null> {
  const [shiftName, shiftMap] = await Promise.all([
    getEmployeeShiftName(employeeId),
    getShiftMap(),
  ]);
  if (!shiftName) return null;
  return shiftMap.get(shiftName) ?? null;
}

function toMinutesOfDay(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const MINUTES_PER_DAY = 24 * 60;

/** A shift whose scheduled end is numerically before its start crosses midnight
 *  (e.g. Night Shift 20:00 -> 05:00). Equal start/end is not treated as crossing. */
export function shiftCrossesMidnight(shift: Pick<ShiftSummary, "startTime" | "endTime">): boolean {
  const start = toMinutesOfDay(shift.startTime);
  const end = toMinutesOfDay(shift.endTime);
  if (start == null || end == null) return false;
  return end < start;
}

/**
 * The "shift day" boundary for a midnight-crossing shift: the midpoint of the shift's
 * *off* window (from its end time through to its next start time), wrapped through
 * midnight. E.g. end=05:00, start=20:00 -> off window is 05:00..20:00 (900 min),
 * boundary = 05:00 + 450min = 12:30.
 *
 * A punch before the boundary is the "morning tail" of yesterday's shift; a punch at
 * or after it is the start of today's shift. Using the midpoint (rather than the exact
 * end/start time) gives slack on both sides for early arrivals and late departures.
 */
function shiftDayBoundaryMinutes(shift: Pick<ShiftSummary, "startTime" | "endTime">): number | null {
  const start = toMinutesOfDay(shift.startTime);
  const end = toMinutesOfDay(shift.endTime);
  if (start == null || end == null) return null;
  const offWindowMinutes = ((start - end) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return (end + Math.floor(offWindowMinutes / 2)) % MINUTES_PER_DAY;
}

/**
 * Which calendar date a punch's IST time-of-day belongs to as a *shift day*, for an
 * employee whose assigned shift crosses midnight. Non-crossing shifts (and unassigned
 * employees) are unaffected — every caller should only reach for this when
 * `shiftCrossesMidnight(shift)` is true; it returns 0 (no adjustment) otherwise.
 *
 * Returns the number of calendar days to subtract from the punch's own IST date to get
 * its shift day: 1 for a "morning tail" punch (e.g. a 05:10 checkout that belongs to
 * last night's shift), 0 for everything else.
 */
export function shiftDayOffset(istTimeString: string, shift: ShiftSummary | null): number {
  if (!shift || !shiftCrossesMidnight(shift)) return 0;
  const boundary = shiftDayBoundaryMinutes(shift);
  const t = toMinutesOfDay(istTimeString);
  if (boundary == null || t == null) return 0;
  return t < boundary ? 1 : 0;
}

/**
 * A check-in counts as late once it's past the shift's start time plus its grace
 * period. Same-calendar-day comparison only — a punch is always attributed to its own
 * `attendanceDate` (see biometric-attendance-derivation.ts), so this never needs to
 * reason about the shift's end time or a midnight crossing.
 */
export function isLateCheckIn(checkIn: string | null, shift: ShiftSummary | null): boolean {
  if (!checkIn || !shift) return false;
  const checkInMinutes = toMinutesOfDay(checkIn);
  const startMinutes = toMinutesOfDay(shift.startTime);
  if (checkInMinutes == null || startMinutes == null) return false;
  return checkInMinutes > startMinutes + shift.graceMinutes;
}
