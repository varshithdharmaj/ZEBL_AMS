import Link from "next/link";
import { Layers } from "lucide-react";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { listBatches } from "@/lib/recruitment/batch/batch-service";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import { NewBatchButton } from "@/components/recruitment/batches/new-batch-button";
import { BatchListTable } from "@/components/recruitment/batches/batch-list-table";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const;

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const raw = await searchParams;
  const show = FILTERS.find((f) => f.value === raw.show)?.value ?? "open";
  const batches = await listBatches(session, {
    status: show === "all" ? "all" : show === "closed" ? HiringBatchStatus.closed : HiringBatchStatus.open,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
        <NewBatchButton />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit" role="tablist" aria-label="Show batches">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "open" ? "/admin/recruitment/batches" : `/admin/recruitment/batches?show=${f.value}`}
            role="tab"
            aria-selected={show === f.value}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              show === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {batches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Layers className="h-8 w-8 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{show === "open" ? "No open batches" : show === "closed" ? "No closed batches" : "No batches yet"}</p>
            <p className="text-sm text-muted-foreground">
              Create a batch for an interview date, then tick candidates on the Pipeline list and choose Add to batch.
            </p>
          </div>
          {show !== "closed" ? <NewBatchButton variant="outline" /> : null}
        </div>
      ) : (
        <BatchListTable batches={batches} hrefBase="/admin/recruitment/batches" />
      )}
    </div>
  );
}
