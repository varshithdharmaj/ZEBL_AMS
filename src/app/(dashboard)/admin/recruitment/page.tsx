import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import { getBatchSheet, listBatches } from "@/lib/recruitment/batch/batch-service";
import { loadDashboardSummary } from "@/lib/recruitment/dashboard/dashboard-summary";
import { RecruitmentDashboardView } from "@/components/recruitment/recruitment-dashboard";
import { withTiming } from "@/lib/observability/timing";
import { greetingFor } from "@/lib/recruitment/dashboard/greeting";

/** Batch boxes. ?batch= opens that batch in an overlay, ?applicationId= a candidate in it. */
export default async function RecruitmentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const raw = await searchParams;
  const showClosed = raw.show === "closed";
  const batchId = typeof raw.batch === "string" ? raw.batch : null;

  const [batches, summary, sheet] = await withTiming("recruitment.dashboard.load", () =>
    Promise.all([
      listBatches(session, { status: showClosed ? HiringBatchStatus.closed : HiringBatchStatus.open, limit: 60 }),
      loadDashboardSummary(),
      batchId ? getBatchSheet(session, batchId) : Promise.resolve(null),
    ])
  );

  return (
    <RecruitmentDashboardView
      batches={batches}
      showClosed={showClosed}
      summary={summary}
      sheet={sheet}
      greeting={greetingFor(session.employeeName)}
    />
  );
}
