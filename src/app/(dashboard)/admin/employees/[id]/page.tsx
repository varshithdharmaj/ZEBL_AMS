import { notFound } from "next/navigation";
import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { EmployeeProfileShell } from "@/components/admin/employee-profile/profile-shell";
import { getEmployeeProfileLeaveData } from "@/actions/leave-balances";
import { getEmployeeAttendanceSummary, getEmployeeById } from "@/lib/data";
import { getManagerCandidates } from "@/lib/org";
import { getActiveShifts } from "@/lib/shifts";
import { getLeavePolicySettings } from "@/lib/leave/leave-policy";
import { defaultDateRange } from "@/lib/utils";
import { parseDateRangeQuery } from "@/lib/date-range";
import type { EmployeeStatus } from "@/lib/employee-types";
import { getSession } from "@/lib/auth";
import { toAppUserRole } from "@/lib/roles";
import { canManageEmployee, canViewUnmaskedStatutoryDetails } from "@/lib/permissions";
import { decryptField } from "@/lib/security/field-encryption";
import { maskAadhaar, maskBankAccount, maskPan } from "@/lib/security/field-masking";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getRequestSecurityContext } from "@/lib/security/request-context";

function decryptOrNull(value: string | null | undefined): string | null {
  return value ? decryptField(value) : null;
}

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string; from?: string; to?: string; preset?: string }>;
}) {
  const { id: idStr } = await params;
  const raw = await searchParams;
  const id = parseInt(idStr, 10);

  if (Number.isNaN(id)) notFound();

  const employee = await getEmployeeById(id);
  if (!employee) notFound();
  const session = await getSession();
  if (!session) notFound();

  const range = parseDateRangeQuery({
    from: raw.from,
    to: raw.to,
    start: raw.start,
    end: raw.end,
    preset: raw.preset,
  });
  const hasRange = Boolean(raw.from || raw.to || raw.start || raw.end || raw.preset);
  const { start: defaultStart, end: defaultEnd } = defaultDateRange();

  const [attendance, leaveData, managerCandidates, shifts, leavePolicy, statutoryDetail, documents] =
    await Promise.all([
      getEmployeeAttendanceSummary(
        id,
        hasRange ? range.from : undefined,
        hasRange ? range.to : undefined
      ),
      getEmployeeProfileLeaveData(id),
      getManagerCandidates(id),
      getActiveShifts(),
      getLeavePolicySettings(),
      prisma.employeeStatutoryDetail.findUnique({ where: { employeeId: id } }),
      prisma.employeeDocument.findMany({
        where: { employeeId: id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { email: true } } },
      }),
    ]);

  const plainStatutory = {
    pan: decryptOrNull(statutoryDetail?.panEnc),
    aadhaar: decryptOrNull(statutoryDetail?.aadhaarEnc),
    uan: decryptOrNull(statutoryDetail?.uanEnc),
    pfNumber: decryptOrNull(statutoryDetail?.pfNumberEnc),
    esiNumber: decryptOrNull(statutoryDetail?.esiNumberEnc),
    bankAccountNo: decryptOrNull(statutoryDetail?.bankAccountNoEnc),
    ifsc: decryptOrNull(statutoryDetail?.ifscEnc),
    bankName: statutoryDetail?.bankName ?? null,
  };

  const maskedStatutory = {
    pan: plainStatutory.pan ? maskPan(plainStatutory.pan) : null,
    aadhaar: plainStatutory.aadhaar ? maskAadhaar(plainStatutory.aadhaar) : null,
    uan: plainStatutory.uan ? maskAadhaar(plainStatutory.uan) : null,
    pfNumber: plainStatutory.pfNumber ? maskBankAccount(plainStatutory.pfNumber) : null,
    esiNumber: plainStatutory.esiNumber ? maskBankAccount(plainStatutory.esiNumber) : null,
    bankAccountNo: plainStatutory.bankAccountNo ? maskBankAccount(plainStatutory.bankAccountNo) : null,
    ifsc: plainStatutory.ifsc,
    bankName: plainStatutory.bankName,
  };

  const canEditStatutory = canManageEmployee(session.role);
  const canUnmaskStatutory = canViewUnmaskedStatutoryDetails({
    actorRole: session.role,
    actorEmployeeId: session.employeeId,
    targetEmployeeId: id,
  });

  if (canUnmaskStatutory && statutoryDetail) {
    const requestContext = await getRequestSecurityContext();
    await writeAuditLog({
      entityType: "employee",
      entityId: String(id),
      action: AUDIT_ACTIONS.EMPLOYEE_STATUTORY_VIEWED,
      actorUserId: session.id,
      actorEmail: session.email,
      employeeId: id,
      module: "employees",
      description: "Employee statutory details were viewed unmasked.",
      requestContext,
    });
  }

  const documentRows = documents.map((doc) => ({
    id: doc.id,
    documentType: doc.documentType,
    fileName: doc.fileName,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt,
    uploadedByEmail: doc.uploadedBy?.email ?? null,
  }));

  const [pendingLeaves, approvedLeavesYtd] = await Promise.all([
    prisma.leaveRequest.count({
      where: {
        employeeId: id,
        workflowStatus: LeaveWorkflowStatus.pending_approval,
      },
    }),
    prisma.leaveRequest.count({
      where: {
        employeeId: id,
        workflowStatus: LeaveWorkflowStatus.approved,
        createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
    }),
  ]);

  const overviewStats = {
    pendingLeaves,
    approvedLeavesYtd,
    attendancePercent: attendance.attendancePercent,
    lastAttendance: attendance.lastAttendanceDate,
  };

  const profileEmployee = {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.name,
    firstName: employee.firstName,
    lastName: employee.lastName,
    preferredName: employee.preferredName,
    gender: employee.gender,
    dateOfBirth: employee.dateOfBirth,
    email: employee.email,
    phone: employee.phone,
    alternatePhone: employee.alternatePhone,
    address: employee.address,
    emergencyContact: employee.emergencyContact,
    department: employee.department,
    designation: employee.designation,
    employmentType: employee.employmentType,
    workLocation: employee.workLocation,
    shift: employee.shift,
    joiningDate: employee.joiningDate,
    employeeStatus: employee.employeeStatus as EmployeeStatus,
    user: employee.user
      ? { ...employee.user, role: toAppUserRole(employee.user.role) }
      : null,
    manager: employee.manager,
    directReportsCount: employee._count.directReports,
  };

  return (
    <EmployeeProfileShell
      employee={profileEmployee}
      attendance={attendance}
      balances={leaveData.balances}
      history={leaveData.history}
      canAdjustLeaveBalance={leavePolicy.allowManualLeaveBalanceAdjustments}
      canAddHistoricalLeave={leavePolicy.allowHistoricalLeaveEntry}
      canEditHistoricalLeave={leavePolicy.allowHistoricalLeaveEdit}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
      managerCandidates={managerCandidates}
      shifts={shifts}
      overviewStats={overviewStats}
      currentUserId={session.id}
      currentUserRole={session.role}
      currentUserEmployeeId={session.employeeId}
      statutory={{
        masked: maskedStatutory,
        unmasked: canUnmaskStatutory ? plainStatutory : null,
        canEdit: canEditStatutory,
        canUnmask: canUnmaskStatutory,
      }}
      documents={documentRows}
    />
  );
}
