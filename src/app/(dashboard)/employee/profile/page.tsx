import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { EmployeePhotoAvatar } from "@/components/shared/employee-photo-avatar";
import { SectionCard } from "@/components/ui/section-card";
import { ContactInfoForm } from "@/components/employee/contact-info-form";
import { LeaveBalanceGrid } from "@/components/leave/leave-balance-grid";
import { LeaveHistoryTab } from "@/components/admin/employee-profile/leave-history-tab";
import { getEmployeeProfileLeaveData } from "@/actions/leave-balances";
import { getSession } from "@/lib/auth";
import { canEditEmployeeProfilePhoto } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function EmployeeSelfProfilePage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const [employee, leaveData] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: session.employeeId },
      select: {
        employeeCode: true,
        designation: true,
        department: true,
        employmentType: true,
        workLocation: true,
        shift: true,
        joiningDate: true,
        manager: { select: { name: true } },
        dateOfBirth: true,
        gender: true,
        phone: true,
        alternatePhone: true,
        address: true,
        emergencyContact: true,
      },
    }),
    getEmployeeProfileLeaveData(session.employeeId),
  ]);

  const displayName = session.employeeName ?? session.email;
  const canEditPhoto = canEditEmployeeProfilePhoto({
    actorRole: session.role,
    actorEmployeeId: session.employeeId,
    targetEmployeeId: session.employeeId,
  });

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        leading={
          <EmployeePhotoAvatar
            userId={session.id}
            imageUrl={session.profilePhotoUrl ?? null}
            alt={`${displayName} profile photo`}
            editable={canEditPhoto}
            size="lg"
          />
        }
        title="My Profile"
        description="Update the profile photo other people see across the app."
      />

      <SectionCard title="Identity" description="Details from your signed-in account">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{session.employeeName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{session.email}</dd>
          </div>
        </dl>
      </SectionCard>

      {employee && (
        <>
          <SectionCard title="Employment" description="Managed by HR — read-only">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Employee code</dt>
                <dd className="font-medium text-foreground">{employee.employeeCode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Designation</dt>
                <dd className="font-medium text-foreground">{employee.designation || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-medium text-foreground">{employee.department || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Employment type</dt>
                <dd className="font-medium text-foreground">{employee.employmentType || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Work location</dt>
                <dd className="font-medium text-foreground">{employee.workLocation || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shift</dt>
                <dd className="font-medium text-foreground">{employee.shift || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Manager</dt>
                <dd className="font-medium text-foreground">{employee.manager?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Joining date</dt>
                <dd className="font-medium text-foreground">{formatDate(employee.joiningDate)}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Personal & Contact"
            description="Phone, address, and emergency contact are yours to keep current. Date of birth and gender are HR-managed."
          >
            <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Date of birth</dt>
                <dd className="font-medium text-foreground">
                  {employee.dateOfBirth ? formatDate(employee.dateOfBirth) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Gender</dt>
                <dd className="font-medium text-foreground">{employee.gender || "—"}</dd>
              </div>
            </dl>
            <ContactInfoForm
              phone={employee.phone}
              alternatePhone={employee.alternatePhone}
              address={employee.address}
              emergencyContact={employee.emergencyContact}
            />
          </SectionCard>

          <SectionCard title="Leave balance" description="Managed by HR — read-only">
            <LeaveBalanceGrid balances={leaveData.balances} />
          </SectionCard>

          <SectionCard title="Leave history" description="Every transaction affecting your leave balance">
            <LeaveHistoryTab history={leaveData.history} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
