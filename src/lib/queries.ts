import { prisma } from "@/lib/prisma";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import {
  startOfDay,
  endOfDay,
  parseDateRange,
  toISODate,
} from "@/lib/utils";

const PAGE_SIZE = 15;
const RANGE_RECORD_LIMIT = 100;

export async function getAdminDashboardStats() {
  const today = startOfDay();
  const todayEnd = endOfDay();

  const [totalEmployees, todayRecords, recentUploads] = await Promise.all([
    prisma.employee.count({ where: { employeeStatus: "Active" } }),
    prisma.attendanceRecord.findMany({
      where: { attendanceDate: { gte: today, lte: todayEnd } },
      include: { employee: true },
      orderBy: { employee: { name: "asc" } },
    }),
    prisma.attendanceUpload.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 5,
    }),
  ]);

  const presentToday = todayRecords.filter((r) => r.status === "Present").length;
  const absentToday = todayRecords.filter((r) => r.status === "Absent").length;
  const shortHoursToday = todayRecords.filter((r) => r.status === "Short Hours").length;

  return {
    totalEmployees,
    presentToday,
    absentToday,
    shortHoursToday,
    todayRecords,
    recentUploads,
  };
}

export async function getEmployeeDashboardData(
  employeeId: number,
  selectedDateStr?: string,
  startStr?: string,
  endStr?: string
) {
  const selectedDate = selectedDateStr
    ? startOfDay(new Date(selectedDateStr + "T00:00:00"))
    : startOfDay();

  if (Number.isNaN(selectedDate.getTime())) {
    return getEmployeeDashboardData(employeeId, undefined, startStr, endStr);
  }

  const { rangeStart, rangeEnd, startIso, endIso, rangeLabel } = parseDateRange(
    startStr,
    endStr
  );
  const dayEnd = endOfDay(selectedDate);

  const [dayRecord, periodRecords, recentRecords] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        attendanceDate: { gte: selectedDate, lte: dayEnd },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        attendanceDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { attendanceDate: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        attendanceDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { attendanceDate: "desc" },
      take: RANGE_RECORD_LIMIT,
    }),
  ]);

  const workingDays = periodRecords.length;
  const periodPresent = periodRecords.filter((r) => r.status === "Present").length;
  const periodShortHours = periodRecords.filter((r) => r.status === "Short Hours").length;
  const periodOT = periodRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0);
  const attendancePercent =
    workingDays > 0 ? Math.round((periodPresent / workingDays) * 100) : 0;

  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId },
    orderBy: { attendanceDate: "desc" },
  });

  return {
    selectedDate: toISODate(selectedDate),
    selectedStart: startIso,
    selectedEnd: endIso,
    day: {
      workedMinutes: dayRecord?.workedMinutes ?? 0,
      checkIn: dayRecord?.checkIn ?? null,
      checkOut: dayRecord?.checkOut ?? null,
      overtimeMinutes: dayRecord?.overtimeMinutes ?? 0,
      status: dayRecord?.status ?? "No Record",
    },
    period: {
      presentDays: periodPresent,
      shortHoursCount: periodShortHours,
      overtimeMinutes: periodOT,
      attendancePercent,
      rangeLabel,
    },
    lastAttendanceDate: lastRecord?.attendanceDate ?? null,
    periodRecords,
    recentRecords,
  };
}

export async function getEmployeeAttendanceSummary(
  employeeId: number,
  startStr?: string,
  endStr?: string
) {
  const { rangeStart, rangeEnd, startIso, endIso, rangeLabel } = parseDateRange(
    startStr,
    endStr
  );

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      attendanceDate: { gte: rangeStart, lte: rangeEnd },
    },
    orderBy: { attendanceDate: "desc" },
    take: RANGE_RECORD_LIMIT,
  });

  const workingDays = records.length;
  const presentDays = records.filter((r) => r.status === "Present").length;
  const shortHoursCount = records.filter((r) => r.status === "Short Hours").length;
  const overtimeMinutes = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);
  const attendancePercent =
    workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId },
    orderBy: { attendanceDate: "desc" },
  });

  return {
    rangeLabel,
    selectedStart: startIso,
    selectedEnd: endIso,
    presentDays,
    shortHoursCount,
    overtimeMinutes,
    attendancePercent,
    lastAttendanceDate: lastRecord?.attendanceDate ?? null,
    records,
  };
}

export async function getEmployeeLeavePageData(employeeId: number) {
  const [balances, leaves] = await Promise.all([
    getLeaveBalanceSummaries(employeeId, { processAccruals: true }),
    prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { balances, leaves };
}

export async function getEmployeeById(id: number) {
  return prisma.employee.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
}

export async function getAttendanceRecords(params: {
  search?: string;
  date?: string;
  page?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (params.date) {
    const d = startOfDay(new Date(params.date));
    if (!Number.isNaN(d.getTime())) {
      where.attendanceDate = { gte: d, lte: endOfDay(d) };
    }
  }

  if (params.search) {
    const q = params.search.trim();
    where.employee = {
      OR: [{ name: { contains: q } }, { employeeCode: { contains: q } }],
    };
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: { employee: true },
      orderBy: [{ attendanceDate: "desc" }, { employee: { name: "asc" } }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { records, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
}

export async function getEmployeeAttendanceHistory(
  employeeId: number,
  page = 1,
  startStr?: string,
  endStr?: string
) {
  const skip = (page - 1) * PAGE_SIZE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { employeeId };

  if (startStr || endStr) {
    const { rangeStart, rangeEnd } = parseDateRange(startStr, endStr);
    where.attendanceDate = { gte: rangeStart, lte: rangeEnd };
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: { attendanceDate: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return {
    records,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getEmployees(search?: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search.trim() } },
          { employeeCode: { contains: search.trim() } },
          { email: { contains: search.trim() } },
          { phone: { contains: search.trim() } },
        ],
      }
    : {};

  return prisma.employee.findMany({
    where,
    include: { user: { select: { email: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getLeaveRequests(role: "admin" | "employee", employeeId?: number) {
  const where = role === "employee" && employeeId ? { employeeId } : {};

  return prisma.leaveRequest.findMany({
    where,
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
}

export { PAGE_SIZE };
