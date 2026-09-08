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

export async function getActiveShifts(): Promise<ShiftSummary[]> {
  return prisma.shift.findMany({
    where: { isActive: true },
    orderBy: { startTime: "asc" },
  });
}
