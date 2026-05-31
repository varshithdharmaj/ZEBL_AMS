import { LeaveWorkflowStatus, NotificationDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNotificationStats } from "@/lib/notifications/admin-queries";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";
import { scanWorkflowIntegrity } from "@/lib/workflow/workflow-integrity";
import { getPendingHrApprovals } from "@/lib/workflow/pending-approvals";
import { getLeaveOverlapWarnings } from "@/lib/leave/leave-overlap";

export async function getHrCommandCenterData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    pendingHr,
    notificationStats,
    integrationSettings,
    workflowScan,
    absentToday,
    onLeaveToday,
    failedNotifications,
    departmentsShortStaffed,
  ] = await Promise.all([
    getPendingHrApprovals(),
    getNotificationStats(),
    getIntegrationSettings(),
    scanWorkflowIntegrity(),
    prisma.attendanceRecord.count({
      where: {
        attendanceDate: { gte: today, lt: tomorrow },
        status: "Absent",
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        workflowStatus: LeaveWorkflowStatus.approved,
        startDate: { lt: tomorrow },
        endDate: { gte: today },
      },
      include: { employee: { select: { name: true, department: true } } },
      take: 15,
    }),
    prisma.notification.count({
      where: { status: NotificationDeliveryStatus.failed },
    }),
    getDepartmentsWithHighAbsence(today, tomorrow),
  ]);

  const escalationRisk = pendingHr.filter((l) => {
    if (!l.submittedAt) return false;
    const hours =
      (Date.now() - l.submittedAt.getTime()) / (1000 * 60 * 60);
    return hours >= integrationSettings.escalationHours;
  });

  const conflictSamples = await Promise.all(
    pendingHr.slice(0, 5).map(async (leave) => ({
      leaveId: leave.id,
      employeeName: leave.employee.name,
      warnings: await getLeaveOverlapWarnings({
        leaveRequestId: leave.id,
        employeeId: leave.employeeId,
        department: leave.employee.department,
        startDate: leave.startDate,
        endDate: leave.endDate,
      }),
    }))
  );

  const leaveConflicts = conflictSamples.filter((c) => c.warnings.length > 0);

  return {
    pendingApprovals: pendingHr.length,
    escalationRisk: escalationRisk.length,
    escalationItems: escalationRisk.slice(0, 5).map((l) => ({
      id: l.id,
      employeeName: l.employee.name,
      leaveType: l.leaveType,
      submittedAt: l.submittedAt,
    })),
    absentToday,
    onLeaveToday: onLeaveToday.map((l) => ({
      id: l.id,
      name: l.employee.name,
      department: l.employee.department,
      leaveType: l.leaveType,
    })),
    failedNotifications,
    notificationPending: notificationStats.pending,
    graphHealth: integrationSettings.graphLastHealthStatus,
    workflowIssues: workflowScan.issues.slice(0, 8),
    workflowStuckCount: workflowScan.stuckCount,
    leaveConflicts,
    departmentsShortStaffed,
  };
}

async function getDepartmentsWithHighAbsence(today: Date, tomorrow: Date) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      attendanceDate: { gte: today, lt: tomorrow },
      status: "Absent",
    },
    include: { employee: { select: { department: true } } },
  });

  const byDept = new Map<string, number>();
  for (const r of records) {
    const dept = r.employee.department ?? "Unassigned";
    byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
  }

  return [...byDept.entries()]
    .filter(([, count]) => count >= 2)
    .map(([department, absentCount]) => ({ department, absentCount }))
    .sort((a, b) => b.absentCount - a.absentCount)
    .slice(0, 5);
}
