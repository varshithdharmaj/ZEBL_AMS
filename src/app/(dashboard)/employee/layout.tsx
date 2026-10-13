import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageSkeleton } from "@/components/loading";
import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";
import {
  canAccessEmployeeShell,
  canAccessHRAdministration,
  canAccessOwnWorkspace,
} from "@/lib/permissions";
import { resolveMyTeamNavContext } from "@/lib/people-scope/nav-context";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { hasPanelistInterviewAssignment } from "@/lib/recruitment/interview/queries";
import { isRecruitmentTestManager } from "@/lib/recruitment/permissions/recruitment-test-manager";
import { hasSharedBatches } from "@/lib/recruitment/batch/batch-access";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessOwnWorkspace(session.role, session.employeeId)) return redirectToLogin();

  const recruitmentOn = isRecruitmentModuleEnabled();
  // Both are small indexed lookups; run them together so the shell renders
  // with the right nav and role label on first paint.
  // My Team nav is presentation-only. Authorization for /employee/approvals
  // remains hierarchy-based on that page.
  const [showPanelistInterviews, myTeamNav, showManagerHiring] = await Promise.all([
    recruitmentOn ? hasPanelistInterviewAssignment(session.employeeId) : false,
    canAccessEmployeeShell(session.role) && session.employeeId != null
      ? resolveMyTeamNavContext(session.employeeId)
      : null,
    recruitmentOn ? hasSharedBatches(session.id) : false,
  ]);

  return (
    <AppShell
      user={session}
      variant="wide"
      showMyTeamGroup={myTeamNav?.showMyTeamGroup ?? false}
      showPanelistInterviews={showPanelistInterviews}
      showManagerHiring={showManagerHiring}
      showRecruitmentNav={recruitmentOn && isRecruitmentTestManager(session)}
      showOwnWorkspaceNav={canAccessHRAdministration(session.role)}
    >
      <Suspense
        fallback={
          <DashboardPageSkeleton
            label="Loading employee workspace"
            kpiCount={3}
            showTable={false}
          />
        }
      >
        {children}
      </Suspense>
    </AppShell>
  );
}
