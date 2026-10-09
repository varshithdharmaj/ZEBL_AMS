import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { EmployeePhotoAvatar } from "@/components/shared/employee-photo-avatar";
import { StatutoryDetailsCard } from "@/components/shared/statutory-details-card";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { SectionCard } from "@/components/ui/section-card";
import { ContactInfoForm } from "@/components/employee/contact-info-form";
import { getSession } from "@/lib/auth";
import { canEditEmployeeProfilePhoto, canViewUnmaskedStatutoryDetails } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { maskStatutoryDetail, readStatutoryDetail } from "@/lib/security/statutory-details";
import { formatDate } from "@/lib/utils";
import { EMPLOYEE_DOCUMENT_TYPE_LABELS } from "@/lib/validation/schemas/employee-document";

export default async function EmployeeSelfProfilePage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const [employee, statutoryRow, documents] = await Promise.all([
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
    prisma.employeeStatutoryDetail.findUnique({ where: { employeeId: session.employeeId } }),
    prisma.employeeDocument.findMany({
      where: { employeeId: session.employeeId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, documentType: true, fileName: true, createdAt: true },
    }),
  ]);

  const displayName = session.employeeName ?? session.email;
  const canEditPhoto = canEditEmployeeProfilePhoto({
    actorRole: session.role,
    actorEmployeeId: session.employeeId,
    targetEmployeeId: session.employeeId,
  });
  const { plain: statutory } = readStatutoryDetail(statutoryRow);
  const canUnmaskStatutory =
    statutoryRow !== null &&
    canViewUnmaskedStatutoryDetails({
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

          {statutory ? (
            <StatutoryDetailsCard
              employeeId={session.employeeId}
              masked={maskStatutoryDetail(statutory)}
              canUnmask={canUnmaskStatutory}
              title="Bank & statutory details"
              description={
                statutoryRow
                  ? "Masked for your privacy. HR keeps these up to date."
                  : "HR hasn't added these details yet."
              }
              footer={
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">Something missing or out of date?</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/employee/tickets/new?topic=statutory-details">Request a change</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <SectionCard title="Bank & statutory details">
              <p className="text-sm text-muted-foreground">
                Your bank and statutory details can&apos;t be shown right now. Please contact HR.
              </p>
            </SectionCard>
          )}

          <SectionCard title="My documents" description="Documents HR keeps on file for you." noPadding>
            <DataTable
              columns={["Type", "File name", "Uploaded", "Actions"]}
              emptyMessage="HR hasn't uploaded any documents for you yet."
            >
              {documents.map((doc) => (
                <DataTableRow key={doc.id}>
                  <DataTableCell>{EMPLOYEE_DOCUMENT_TYPE_LABELS[doc.documentType]}</DataTableCell>
                  <DataTableCell className="max-w-[240px] truncate">{doc.fileName}</DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    {formatDate(doc.createdAt)}
                  </DataTableCell>
                  <DataTableCell>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/employee-documents/download?id=${encodeURIComponent(doc.id)}`}>
                        Download
                      </a>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          </SectionCard>
        </>
      )}
    </div>
  );
}
