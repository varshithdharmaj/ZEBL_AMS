import { notFound } from "next/navigation";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { getBatchSheet, listBatches } from "@/lib/recruitment/batch/batch-service";
import { greetingFor } from "@/lib/recruitment/dashboard/greeting";
import { ManagerHiringView } from "@/components/recruitment/manager-hiring";

/** A manager's batches (the ones HR shared). ?batch= opens one, ?applicationId= a candidate in it. */
export default async function ManagerHiringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isRecruitmentModuleEnabled()) notFound();
  const session = await getSessionOrThrow();
  const raw = await searchParams;
  const showClosed = raw.show === "closed";
  const batchId = typeof raw.batch === "string" ? raw.batch : null;

  const [batches, sheet] = await Promise.all([
    listBatches(session, {
      sharedWithMe: true,
      status: showClosed ? HiringBatchStatus.closed : HiringBatchStatus.open,
      limit: 60,
    }),
    batchId ? getBatchSheet(session, batchId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <ManagerHiringView
      batches={batches}
      showClosed={showClosed}
      sheet={sheet}
      greeting={greetingFor(session.employeeName)}
    />
  );
}
