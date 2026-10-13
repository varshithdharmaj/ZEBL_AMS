import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { savePanelRating } from "@/lib/recruitment/batch/panel-rating";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";

/**
 * Stars from the candidate panel. A route, not a server action, so saving
 * never holds up Esc or J/K in the panel (see the comments route).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const session = await getSessionOrThrow();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const round = body.round === "manager" ? "manager" : body.round === "hr" ? "hr" : null;
    if (!round) return NextResponse.json({ error: "Choose the round." }, { status: 400 });
    await savePanelRating(session, {
      applicationId: id,
      round,
      verdict: body.verdict as never,
      ratingsJson: body.ratingsJson as never,
      remarks: typeof body.remarks === "string" ? body.remarks : undefined,
    });
    revalidatePath(`/admin/recruitment/applications/${id}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Check the rating." }, { status: 400 });
    }
    const status = error instanceof PermissionError ? 403 : isRecruitmentDomainError(error) ? 400 : 500;
    return NextResponse.json({ error: mapUnknownToActionState(error).error }, { status });
  }
}
