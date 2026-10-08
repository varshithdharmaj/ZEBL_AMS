import Link from "next/link";
import type { BatchListItem } from "@/lib/recruitment/batch/batch-service";
import { BatchProgressLegend } from "@/components/recruitment/batches/batch-progress-legend";
import { formatInterviewDate } from "@/lib/recruitment/batch/batch-membership";
import { cn } from "@/lib/utils";

function formatDay(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function BatchListTable({
  batches,
  hrefBase,
  showCreated = true,
  className,
}: {
  batches: BatchListItem[];
  hrefBase: string;
  showCreated?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Batch ID</th>
            <th className="px-4 py-2.5 font-medium">Interview date</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 text-right font-medium">Candidates</th>
            <th className="hidden w-[38%] px-4 py-2.5 font-medium md:table-cell">Progress</th>
            {showCreated ? <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Created</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {batches.map((b) => (
            <tr key={b.id} className="group relative hover:bg-muted/40">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] font-semibold">
                <Link
                  href={`${hrefBase}/${b.id}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/40"
                >
                  {b.code}
                </Link>
                {b.status === "closed" ? (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">Closed</span>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {formatInterviewDate(b.interviewDate) ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3">{b.name ?? <span className="text-muted-foreground">—</span>}</td>
              <td className="px-4 py-3 text-right tabular-nums">{b.candidateCount}</td>
              <td className="hidden px-4 py-3 md:table-cell">
                <BatchProgressLegend progress={b.progress} />
              </td>
              {showCreated ? (
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                  {formatDay(b.createdAt)}
                  {b.createdByName ? <span className="block text-xs">{b.createdByName}</span> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
