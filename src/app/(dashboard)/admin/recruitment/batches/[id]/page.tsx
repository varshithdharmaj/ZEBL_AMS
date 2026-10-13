import { notFound } from "next/navigation";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getBatchSheet } from "@/lib/recruitment/batch/batch-service";
import { BatchSheetView } from "@/components/recruitment/batches/batch-sheet-view";

/** One batch. ?applicationId= opens that candidate's panel (it loads its own details). */
export default async function BatchSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRecruitmentAdminSession();
  const { id } = await params;
  const sheet = await getBatchSheet(session, id);
  if (!sheet) notFound();

  return <BatchSheetView sheet={sheet} />;
}
