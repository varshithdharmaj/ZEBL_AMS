"use client";

import Link from "next/link";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import type { BatchListItem, BatchSheet } from "@/lib/recruitment/batch/batch-service";
import { BatchBox, BatchOverlay, groupBatches } from "@/components/recruitment/recruitment-dashboard";
import { cn } from "@/lib/utils";

/**
 * The manager's hiring page: the batches HR shared with them, same boxes and
 * overlay as HR's dashboard. In the panel they rate the Manager Round and
 * decide Hire, Reject or Hold.
 */
export function ManagerHiringView({
  batches,
  showClosed,
  sheet,
  greeting,
}: {
  batches: BatchListItem[];
  showClosed: boolean;
  sheet: BatchSheet | null;
  greeting: { title: string; date: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openBatch = useCallback(
    (batchId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("applicationId");
      if (batchId) params.set("batch", batchId);
      else params.delete("batch");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const waiting = showClosed ? 0 : batches.reduce((sum, b) => sum + b.progress.manager_round, 0);
  const groups = groupBatches(batches);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{greeting.date}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting.title}</h1>
        <p className="text-sm text-muted-foreground">
          {showClosed
            ? "Batches HR has closed."
            : waiting > 0
              ? `${waiting} ${waiting === 1 ? "candidate is" : "candidates are"} waiting for your decision in the Manager Round.`
              : batches.length > 0
                ? "No one is waiting for you right now."
                : "HR hasn't shared a batch with you yet."}
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold">Batches shared with you</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{batches.length}</span>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-sm">
            <Link
              href="/employee/hiring"
              scroll={false}
              className={cn("rounded-md px-3 py-1", !showClosed ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              Open
            </Link>
            <Link
              href="/employee/hiring?show=closed"
              scroll={false}
              className={cn("rounded-md px-3 py-1", showClosed ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              Closed
            </Link>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">{showClosed ? "No closed batches" : "Nothing shared with you yet"}</p>
            {!showClosed ? (
              <p className="max-w-sm text-sm text-muted-foreground">
                When HR shares a batch with you, it shows up here. Open it to rate the Manager Round and decide.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.flatMap((group) =>
              group.items.map((batch) => (
                <BatchBox
                  key={batch.id}
                  batch={batch}
                  highlight={group.id === "today"}
                  showManagers={false}
                  onOpen={() => openBatch(batch.id)}
                />
              ))
            )}
          </div>
        )}
      </section>

      {sheet ? (
        <BatchOverlay sheet={sheet} mode="manager" panelOpen={searchParams.has("applicationId")} onClose={() => openBatch(null)} />
      ) : null}
    </div>
  );
}
