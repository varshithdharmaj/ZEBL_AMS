import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveMyTeamNavContext } from "@/lib/people-scope/nav-context";
import { getHelpChapters, HELP_GUIDE_META } from "@/lib/help/guides";
import { renderHelpGuidePdf } from "@/lib/help/pdf/render-help-guide-pdf";

export async function GET() {
  const session = await getSession();
  if (!session?.employeeId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { isLineManager } = await resolveMyTeamNavContext(session.employeeId);
  const role = isLineManager ? "manager" : "employee";
  const meta = HELP_GUIDE_META[role];
  const chapters = getHelpChapters(role, isLineManager);

  const buffer = await renderHelpGuidePdf(meta, chapters);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ZEBL-AMS-User-Guide-${meta.roleLabel.replace(/\s+/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
