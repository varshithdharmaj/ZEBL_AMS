import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { NoteVisibility } from "@/generated/prisma/enums";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { listCandidateComments } from "@/lib/recruitment/batch/batch-service";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";

/**
 * Comments in the batch panel. A route, not a server action: Next.js runs
 * server actions one at a time ahead of page changes, so a slow save would
 * hold up Esc and J/K in the panel.
 */

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid comment." }, { status: 400 });
  }
  const status = error instanceof PermissionError ? 403 : isRecruitmentDomainError(error) ? 400 : 500;
  return NextResponse.json({ error: mapUnknownToActionState(error).error }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    const { id } = await params;
    return NextResponse.json({ comments: await listCandidateComments(session, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Same-site only (server actions get this check from Next.js).
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const session = await getSessionOrThrow();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { body?: unknown; hrOnly?: unknown };
    // "Only HR can see" is for HR; everyone else writes team comments.
    const hrOnly = body.hrOnly === true && canAccessRecruitmentAdministration(session);
    await createCandidateService().addCandidateNote(session, {
      candidateId: id,
      body: typeof body.body === "string" ? body.body : "",
      visibility: hrOnly ? NoteVisibility.hr_only : NoteVisibility.team,
    });
    revalidatePath(`/admin/recruitment/candidates/${id}`);
    return NextResponse.json({ comments: await listCandidateComments(session, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
