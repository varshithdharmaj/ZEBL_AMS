import { prisma } from "@/lib/prisma";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "@/lib/utils";

const PAGE_SIZE = 15;

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

function parseMonthParam(monthStr?: string): Date {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  return startOfMonth();
}

export async function getEmployeeDashboardData(
  employeeId: number,
  selectedDateStr?: string,
  monthStr?: string
) {
  const selectedDate = selectedDateStr
    ? startOfDay(new Date(selectedDateStr))
    : startOfDay();

  if (Number.isNaN(selectedDate.getTime())) {
    return getEmployeeDashboardData(employeeId, undefined, monthStr);
  }

  const monthAnchor = parseMonthParam(monthStr);
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);
  const dayEnd = endOfDay(selectedDate);

  const [dayRecord, monthlyRecords, recentRecords] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        attendanceDate: { gte: selectedDate, lte: dayEnd },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        attendanceDate: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { attendanceDate: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        attendanceDate: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { attendanceDate: "desc" },
      take: 15,
    }),
  ]);

  const workingDays = monthlyRecords.length;
  const monthlyPresent = monthlyRecords.filter((r) => r.status === "Present").length;
  const monthlyShortHours = monthlyRecords.filter((r) => r.status === "Short Hours").length;
  const monthlyOT = monthlyRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0);
  const attendancePercent =
    workingDays > 0 ? Math.round((monthlyPresent / workingDays) * 100) : 0;

  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId },
    orderBy: { attendanceDate: "desc" },
  });

  return {
    selectedDate: selectedDate.toISOString().split("T")[0],
    selectedMonth: `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, "0")}`,
    day: {
      workedMinutes: dayRecord?.workedMinutes ?? 0,
      checkIn: dayRecord?.checkIn ?? null,
      checkOut: dayRecord?.checkOut ?? null,
      overtimeMinutes: dayRecord?.overtimeMinutes ?? 0,
      status: dayRecord?.status ?? "No Record",
    },
    monthly: {
      presentDays: monthlyPresent,
      shortHoursCount: monthlyShortHours,
      overtimeMinutes: monthlyOT,
      attendancePercent,
      monthLabel: monthAnchor.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      }),
    },
    lastAttendanceDate: lastRecord?.attendanceDate ?? null,
    recentRecords,
  };
}

export async function getEmployeeAttendanceSummary(
  employeeId: number,
  monthStr?: string
) {
  const monthAnchor = parseMonthParam(monthStr);
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      attendanceDate: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { attendanceDate: "desc" },
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
    monthLabel: monthAnchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    selectedMonth: `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, "0")}`,
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

export async function getEmployeeAttendanceHistory(employeeId: number, page = 1) {
  const skip = (page - 1) * PAGE_SIZE;

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId },
      orderBy: { attendanceDate: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.attendanceRecord.count({ where: { employeeId } }),
  ]);

  return { records, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
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
