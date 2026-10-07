import { notFound } from "next/navigation";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getBatchSheet, listJobsForBatch } from "@/lib/recruitment/batch/batch-service";
import { loadPipelineDrawerApplication } from "@/lib/recruitment/application/pipeline-drawer-data";
import { BatchSheetView } from "@/components/recruitment/batches/batch-sheet-view";
import type { PipelineDrawerTab } from "@/components/recruitment/applications/application-pipeline-drawer";

const TABS: readonly PipelineDrawerTab[] = ["overview", "resume", "feedback", "activity"];

export default async function BatchSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  const applicationId = typeof raw.applicationId === "string" ? raw.applicationId : null;
  const tab = TABS.find((t) => t === raw.tab) ?? "overview";

  const [sheet, jobs, selectedApplication] = await Promise.all([
    getBatchSheet(session, id),
    listJobsForBatch(session),
    applicationId ? loadPipelineDrawerApplication(session, applicationId) : Promise.resolve(null),
  ]);
  if (!sheet) notFound();

  return (
    <BatchSheetView
      sheet={sheet}
      jobs={jobs}
      selectedApplication={selectedApplication}
      initialTab={tab}
      openPaste={raw.paste === "1"}
    />
  );
}
