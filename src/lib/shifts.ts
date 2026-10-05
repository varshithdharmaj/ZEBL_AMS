import { prisma } from "@/lib/prisma";

export type ShiftSummary = {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  expectedWorkMinutes: number;
  isActive: boolean;
};

export async function getShifts(): Promise<ShiftSummary[]> {
  return prisma.shift.findMany({ orderBy: { startTime: "asc" } });
}

export type UnrecognisedShiftLabel = {
  /** Exactly as stored on Employee.shift. */
  label: string;
  employeeCount: number;
};

/**
 * Employee.shift values that match no Shift by exact name (legacy imports, typos).
 * Attendance and payroll look shifts up by exact name, so these employees silently
 * get no shift timing at all.
 */
export async function getUnrecognisedShiftLabels(): Promise<UnrecognisedShiftLabel[]> {
  const shifts = await prisma.shift.findMany({ select: { name: true } });
  const groups = await prisma.employee.groupBy({
    by: ["shift"],
    where: { shift: { notIn: shifts.map((shift) => shift.name) } },
    _count: { _all: true },
  });
  return groups
    .filter((group): group is typeof group & { shift: string } => Boolean(group.shift?.trim()))
    .map((group) => ({ label: group.shift, employeeCount: group._count._all }))
    .sort((a, b) => b.employeeCount - a.employeeCount);
}

export async function getActiveShifts(): Promise<ShiftSummary[]> {
  return prisma.shift.findMany({
    where: { isActive: true },
    orderBy: { startTime: "asc" },
  });
}
