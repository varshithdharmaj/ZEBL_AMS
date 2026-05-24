import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";

/** @deprecated Use WorkspacePageHeader */
export function EmployeePageHeader({
  title,
  description,
  backHref = "/employee/dashboard",
  backLabel = "Dashboard",
  action,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <WorkspacePageHeader
      title={title}
      description={description}
      backHref={backHref}
      backLabel={backLabel}
      action={action}
    />
  );
}
