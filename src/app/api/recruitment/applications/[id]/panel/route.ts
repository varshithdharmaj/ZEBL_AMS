import { NextResponse } from "next/server";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { loadPipelineDrawerApplication } from "@/lib/recruitment/application/pipeline-drawer-data";
import { PermissionError } from "@/lib/permissions";

/**
 * The candidate panel's details (scorecards, offers, resume), fetched by the
 * panel itself so moving to the next person doesn't reload the whole page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    const { id } = await params;
    const application = await loadPipelineDrawerApplication(session, id);
    if (!application) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof PermissionError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Couldn't load this candidate." }, { status: 500 });
  }
}
