import Link from "next/link";
import { Bug } from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { Button } from "@/components/ui/button";
import { AdminOperationsView } from "@/components/admin/admin-operations-view";
import { getOperationsDashboard } from "@/lib/operations/ops-queries";

export default async function AdminOperationsPage() {
  const data = await getOperationsDashboard();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Operations"
        description="Worker health, queue depth, failed jobs, and workflow integrity at a glance."
        action={
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/admin/operations/errors">
              <Bug className="h-4 w-4" />
              Error Log
            </Link>
          </Button>
        }
      />
      <AdminOperationsView data={data} />
    </div>
  );
}
