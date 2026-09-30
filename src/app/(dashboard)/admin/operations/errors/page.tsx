import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AdminErrorLogView } from "@/components/admin/admin-error-log-view";
import { requireAdminSession } from "@/lib/auth-guards";
import { searchAppErrors } from "@/lib/observability/error-log-queries";

export default async function AdminErrorLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const result = await searchAppErrors({ q: params.q, page });

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Error Log"
        description="Server errors with their full details. Paste the Ref from an error message to find it."
        backHref="/admin/operations"
        backLabel="Operations"
      />
      <AdminErrorLogView result={result} page={page} q={params.q} />
    </div>
  );
}
