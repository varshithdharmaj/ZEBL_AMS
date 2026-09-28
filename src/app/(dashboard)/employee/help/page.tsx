import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { HelpGuideView } from "@/components/help/help-guide-view";
import { getSession } from "@/lib/auth";
import { resolveMyTeamNavContext } from "@/lib/people-scope/nav-context";
import { getHelpChapters, HELP_GUIDE_META } from "@/lib/help/guides";

export default async function EmployeeHelpPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const { isLineManager } = await resolveMyTeamNavContext(session.employeeId);
  const role = isLineManager ? "manager" : "employee";
  const chapters = getHelpChapters(role, isLineManager);
  const meta = HELP_GUIDE_META[role];

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader title={`${meta.roleLabel} User Guide`} description={meta.coverDescription} />
      <SectionCard>
        <HelpGuideView chapters={chapters} accent={meta.accent} pdfHref="/employee/help/pdf" />
      </SectionCard>
    </div>
  );
}
