import { NextResponse } from "next/server";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/permissions";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getEmployeeStorage } from "@/lib/recruitment/storage/employee-storage";
import { sanitizeDownloadFileName } from "@/lib/recruitment/shared/storage-paths";
import { getRequestSecurityContext } from "@/lib/security/request-context";

export async function GET(request: Request) {
  try {
    const session = await getSessionOrThrow();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return new NextResponse("Missing document id.", { status: 400 });
    }

    // HR/Super Admin can download any employee's documents; employees only their own.
    // Someone else's document gets the same 404 as a missing one.
    const doc = await prisma.employeeDocument.findUnique({ where: { id } });
    const canDownload =
      doc !== null && (canManageEmployee(session.role) || session.employeeId === doc.employeeId);
    if (!doc || doc.deletedAt || !canDownload) {
      return new NextResponse("Document not found.", { status: 404 });
    }

    const content = await getEmployeeStorage().read(doc.storageKey);

    const requestContext = await getRequestSecurityContext();
    await writeAuditLog({
      entityType: "employee_document",
      entityId: doc.id,
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOADED,
      actorUserId: session.id,
      actorEmail: session.email,
      employeeId: doc.employeeId,
      module: "employees",
      description: "Employee document was downloaded.",
      metadata: {
        documentType: doc.documentType,
        fileName: doc.fileName,
        ownDocument: session.employeeId === doc.employeeId,
      },
      requestContext,
    });

    const downloadName = sanitizeDownloadFileName(doc.fileName);
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
