import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import { listBatches } from "@/lib/recruitment/batch/batch-service";
import { loadHrToday } from "@/lib/recruitment/dashboard/hr-today";
import { RecruitmentDashboardView } from "@/components/recruitment/recruitment-dashboard";
import { withTiming } from "@/lib/observability/timing";

export default async function RecruitmentDashboardPage() {
  const session = await requireRecruitmentAdminSession();
  const [today, openBatches] = await withTiming("recruitment.dashboard.load", () =>
    Promise.all([loadHrToday(), listBatches(session, { status: HiringBatchStatus.open })])
  );

  return <RecruitmentDashboardView today={today} openBatches={openBatches} />;
}
