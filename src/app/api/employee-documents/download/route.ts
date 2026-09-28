import { NextResponse } from "next/server";
import { requireManageEmployeeSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getEmployeeStorage } from "@/lib/recruitment/storage/employee-storage";
import { sanitizeDownloadFileName } from "@/lib/recruitment/shared/storage-paths";
import { getRequestSecurityContext } from "@/lib/security/request-context";

export async function GET(request: Request) {
  try {
    const session = await requireManageEmployeeSession();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return new NextResponse("Missing document id.", { status: 400 });
    }

    const doc = await prisma.employeeDocument.findUnique({ where: { id } });
    if (!doc || doc.deletedAt) {
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
      metadata: { documentType: doc.documentType, fileName: doc.fileName },
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
