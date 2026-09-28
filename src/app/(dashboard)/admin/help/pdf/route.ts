import { NextResponse } from "next/server";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getHelpChapters, HELP_GUIDE_META } from "@/lib/help/guides";
import { renderHelpGuidePdf } from "@/lib/help/pdf/render-help-guide-pdf";

export async function GET() {
  const session = await requireHROrSuperAdminSession();
  const role = session.role === "super_admin" ? "super_admin" : "hr";
  const meta = HELP_GUIDE_META[role];
  const chapters = getHelpChapters(role);

  const buffer = await renderHelpGuidePdf(meta, chapters);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ZEBL-AMS-User-Guide-${meta.roleLabel.replace(/\s+/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
