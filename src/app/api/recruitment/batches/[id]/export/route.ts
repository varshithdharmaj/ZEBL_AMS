import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { getBatchSheet } from "@/lib/recruitment/batch/batch-service";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";

/** The batch as an .xlsx in HR's sheet column order, plus Role, HR stars and Stage. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isRecruitmentModuleEnabled()) {
      return NextResponse.json({ error: "Recruitment module is disabled." }, { status: 403 });
    }
    const session = await requireRecruitmentAdminSession();
    const { id } = await params;
    const sheet = await getBatchSheet(session, id);
    if (!sheet) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

    const only = new URL(request.url).searchParams.getAll("ids");
    const rows = only.length > 0 ? sheet.rows.filter((r) => only.includes(r.memberId)) : sheet.rows;

    const data = rows.map((r) => ({
      "Sl.no": r.slNo,
      Name: r.name,
      "Email ID": r.email ?? "",
      "Phone Number": r.phone ?? "",
      "Current Location": r.location ?? "",
      Qualification: r.qualification ?? "",
      "Total Experience": r.experienceYears ?? "",
      Remarks: r.remarks ?? "",
      Availability: r.availability ?? "",
      "Candidate profile": r.profile ?? (r.resume ? r.resume.fileName : ""),
      Role: r.role,
      "HR stars": r.hrStars ?? "",
      Stage: r.stageLabel,
    }));

    const sheetName = sheet.code;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    // Phone numbers are written as text, so Excel won't turn them into 9.88E+09.
    ws["!cols"] = [
      { wch: 6 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 8 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const body = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const fileName = `${[sheet.code, sheet.name].filter(Boolean).join(" ")}`.replace(/[^\w .-]+/g, "").trim() || sheet.code;
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isRecruitmentDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[batch.export] failed", error);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
