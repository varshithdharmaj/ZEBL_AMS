import Link from "next/link";
import { Layers } from "lucide-react";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { listBatches } from "@/lib/recruitment/batch/batch-service";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import { NewBatchButton } from "@/components/recruitment/batches/new-batch-button";
import { BatchProgressBar, BatchProgressLegend } from "@/components/recruitment/batches/batch-progress-bar";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const;

function formatDay(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

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
              Create a batch, then paste the candidates straight from your Excel sheet.
            </p>
          </div>
          {show !== "closed" ? <NewBatchButton variant="outline" /> : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Batch ID</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Candidates</th>
                <th className="hidden w-[38%] px-4 py-2.5 font-medium md:table-cell">Progress</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.map((b) => (
                <tr key={b.id} className="group relative hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] font-semibold">
                    <Link href={`/admin/recruitment/batches/${b.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/40">
                      {b.code}
                    </Link>
                    {b.status === "closed" ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">Closed</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{b.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.candidateCount}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="space-y-1.5">
                      <BatchProgressBar progress={b.progress} total={b.candidateCount} />
                      <BatchProgressLegend progress={b.progress} />
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatDay(b.createdAt)}
                    {b.createdByName ? <span className="block text-xs">{b.createdByName}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
