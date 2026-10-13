import Link from "next/link";
import { Plus } from "lucide-react";
import type { BatchListItem } from "@/lib/recruitment/batch/batch-service";
import { BATCH_BUCKETS, batchWait, type BatchWaitKind } from "@/lib/recruitment/batch/batch-progress";
import type { HrToday } from "@/lib/recruitment/dashboard/hr-today";
import { Button } from "@/components/ui/button";
import { NewBatchButton } from "@/components/recruitment/batches/new-batch-button";
import { cn } from "@/lib/utils";

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

function clock(value: Date): string {
  return value.toLocaleTimeString("en-IN", { ...IST, hour: "numeric", minute: "2-digit" });
}

function shortDate(value: Date): string {
  return value.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short" });
}

function weekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const start = weekStart.toLocaleDateString("en-IN", { ...IST, weekday: "short", day: "numeric" });
  const end = weekEnd.toLocaleDateString("en-IN", { ...IST, weekday: "short", day: "numeric", month: "short" });
  return `${start} – ${end}`;
}

function withNames(names: string[], count: number): string {
  if (names.length === 0) return "";
  const extra = count - names.length;
  const shown = extra > 0 ? `${names.join(", ")} and ${extra} more` : names.join(", ");
  return `: ${shown}`;
}

type Need = { count: number; href: string; text: string };

function needsYouToday(today: HrToday): Need[] {
  const items: Need[] = [];
  const hire = today.hireWithoutOffer;
  if (hire.count > 0) {
    items.push({
      count: hire.count,
      href: "/admin/recruitment/pipeline?currentStage=hire",
      text: `hired. Make their offers${withNames(hire.names, hire.count)}`,
    });
  }
  const stars = today.missingHrStars;
  if (stars.count > 0) {
    items.push({
      count: stars.count,
      href: stars.batchId ? `/admin/recruitment/batches/${stars.batchId}` : "/admin/recruitment/batches",
      text: stars.batchCode
        ? `candidates in ${stars.batchCode} have no HR stars yet`
        : "candidates have no HR stars yet",
    });
  }
  if (today.interviewsToday.length > 0) {
    const shown = today.interviewsToday
      .slice(0, 3)
      .map((interview) => `${clock(interview.start)} ${interview.candidateName}`)
      .join(", ");
    const only = today.interviewsToday.length === 1 ? today.interviewsToday[0] : null;
    items.push({
      count: today.interviewsToday.length,
      href: only ? `/admin/recruitment/interviews/${only.id}` : "/admin/recruitment/interviews",
      text: `interviews today: ${shown}`,
    });
  }
  const offers = today.offersNoReply;
  if (offers.count > 0) {
    items.push({
      count: offers.count,
      href: "/admin/recruitment/offers?status=released",
      text: `${offers.count === 1 ? "offer" : "offers"} with no reply for 3 days${withNames(offers.names, offers.count)}`,
    });
  }
  if (today.pendingConversions > 0) {
    items.push({
      count: today.pendingConversions,
      href: "/admin/recruitment/conversions",
      text: today.pendingConversions === 1 ? "accepted offer to convert" : "accepted offers to convert",
    });
  }
  return items;
}

function weekLine(week: HrToday["week"]): string {
  const parts = [
    week.added > 0 ? `${week.added} added` : null,
    week.hrRated > 0 ? `${week.hrRated} rated` : null,
    week.sentToManager > 0 ? `${week.sentToManager} sent to managers` : null,
    week.hired > 0 ? `${week.hired} hired` : null,
    week.joined > 0 ? `${week.joined} joined` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "Nothing moved";
}

const WAIT_STYLE: Record<BatchWaitKind, string> = {
  you: "bg-muted text-foreground",
  manager: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  close: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export function RecruitmentDashboardView({
  today,
  openBatches,
}: {
  today: HrToday;
  openBatches: BatchListItem[];
}) {
  const needs = needsYouToday(today);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Recruitment</h1>
        <div className="flex flex-wrap gap-2">
          <NewBatchButton />
          <Button asChild variant="outline">
            <Link href="/admin/recruitment/candidates/new">
              <Plus className="h-4 w-4" />
              Add candidate
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/recruitment/jobs/new">Create job</Link>
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Needs you today</h2>
          <p className="text-xs text-muted-foreground">A line stays until that work is done</p>
        </div>
        {needs.length === 0 ? (
          <p className="px-4 py-4 text-sm">All caught up.</p>
        ) : (
          <ul className="divide-y divide-border">
            {needs.map((item) => (
              <li key={item.href + item.text}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-amber-100 px-1.5 text-xs font-semibold tabular-nums text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    {item.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium tabular-nums">{item.count}</span> {item.text}
                  </span>
                  <span className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
                    Open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Open batches</h2>
          <Link href="/admin/recruitment/batches" className="text-xs text-muted-foreground hover:text-foreground">
            All batches
          </Link>
        </div>
        {openBatches.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No open batches. Create one for an interview date, then add people from the batch page or the Pipeline list.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Batch ID</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 text-right font-medium">Candidates</th>
                  <th className="px-4 py-2 font-medium">Where they are</th>
                  <th className="px-4 py-2 font-medium">Waiting on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {openBatches.map((batch) => {
                  const wait = batchWait(batch.progress);
                  const places = BATCH_BUCKETS.filter((bucket) => batch.progress[bucket.id] > 0);
                  return (
                    <tr key={batch.id} className="hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link href={`/admin/recruitment/batches/${batch.id}`} className="font-mono text-[13px] font-semibold hover:underline">
                          {batch.code}
                        </Link>
                        {batch.interviewDate ? (
                          <span className="block text-xs text-muted-foreground">{shortDate(batch.interviewDate)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{batch.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{batch.candidateCount}</td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1.5">
                          {places.map((bucket) => (
                            <span key={bucket.id} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {bucket.label} <span className="font-medium text-foreground">{batch.progress[bucket.id]}</span>
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {wait ? (
                          <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", WAIT_STYLE[wait.kind])}>
                            {wait.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">This week</h2>
          <p className="text-xs text-muted-foreground">{weekRange(today.week.weekStart)}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{weekLine(today.week)}</p>
      </section>
    </div>
  );
}
