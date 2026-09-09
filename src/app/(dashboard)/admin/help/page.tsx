import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { HelpGuideView } from "@/components/help/help-guide-view";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getHelpChapters, HELP_GUIDE_META } from "@/lib/help/guides";

export default async function AdminHelpPage() {
  const session = await requireHROrSuperAdminSession();
  const role = session.role === "super_admin" ? "super_admin" : "hr";
  const chapters = getHelpChapters(role);
  const meta = HELP_GUIDE_META[role];

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader title={`${meta.roleLabel} User Guide`} description={meta.coverDescription} />
      <SectionCard>
        <HelpGuideView chapters={chapters} accent={meta.accent} pdfHref="/admin/help/pdf" />
      </SectionCard>
    </div>
  );
}
