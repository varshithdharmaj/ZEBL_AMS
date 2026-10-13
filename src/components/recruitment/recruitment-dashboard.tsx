"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, CalendarDays, Check, ChevronRight, Plus, Send, UserCheck, Users, X } from "lucide-react";
import type { BatchListItem, BatchSheet } from "@/lib/recruitment/batch/batch-service";
import { decidedCount } from "@/lib/recruitment/batch/batch-progress";
import type { DashboardPerson, DashboardSummary } from "@/lib/recruitment/dashboard/dashboard-summary";
import { Button } from "@/components/ui/button";
import { NewBatchButton } from "@/components/recruitment/batches/new-batch-button";
import { BatchSheetView } from "@/components/recruitment/batches/batch-sheet-view";
import { cn } from "@/lib/utils";

const IST = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

export function istDay(value: Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: IST });
}

/** "Today", "Tomorrow", "Yesterday", else "Wed, 15 Oct". */
export function dayLabel(value: Date): string {
  const day = istDay(value);
  const now = Date.now();
  if (day === istDay(new Date(now))) return "Today";
  if (day === istDay(new Date(now + DAY_MS))) return "Tomorrow";
  if (day === istDay(new Date(now - DAY_MS))) return "Yesterday";
  return new Date(value).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
}

/** "today" inside a sentence; real dates keep their capitals. */
function inSentence(value: Date): string {
  const label = dayLabel(value);
  return ["Today", "Tomorrow", "Yesterday"].includes(label) ? label.toLowerCase() : `on ${label}`;
}

/** "AR" for "Arjun Reddy"; skips the "Demo ·" style prefixes. */
function initials(name: string): string {
  const words = name.replace(/^.*·\s*/, "").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

type BatchGroup = { id: string; label: string; items: BatchListItem[] };

/** Today first, then the coming days (soonest first), then earlier ones (latest first). */
export function groupBatches(batches: BatchListItem[]): BatchGroup[] {
  const today = istDay(new Date());
  const groups: BatchGroup[] = [
    { id: "today", label: "Today", items: [] },
    { id: "upcoming", label: "Coming up", items: [] },
    { id: "earlier", label: "Earlier", items: [] },
  ];
  for (const b of batches) {
    const day = b.interviewDate ? istDay(b.interviewDate) : null;
    if (day === today) groups[0].items.push(b);
    else if (day && day > today) groups[1].items.push(b);
    else groups[2].items.push(b);
  }
  groups[1].items.reverse();
  return groups.filter((g) => g.items.length > 0);
}

export function RecruitmentDashboardView({
  batches,
  showClosed,
  summary,
  sheet,
  greeting,
}: {
  batches: BatchListItem[];
  showClosed: boolean;
  summary: DashboardSummary;
  sheet: BatchSheet | null;
  /** Worked out on the server so it matches the IST clock: "Good morning, Sowmya" and the date. */
  greeting: { title: string; date: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openBatch = useCallback(
    (batchId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("applicationId");
      params.delete("tab");
      if (batchId) params.set("batch", batchId);
      else params.delete("batch");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const groups = groupBatches(batches);
  const todayCount = groups.find((g) => g.id === "today")?.items.length ?? 0;
  const todayLine = [
    showClosed
      ? null
      : todayCount > 0
        ? `${todayCount} ${todayCount === 1 ? "batch is" : "batches are"} interviewing today`
        : "No interviews today",
    summary.newCandidates.count > 0
      ? `${summary.newCandidates.count} new ${summary.newCandidates.count === 1 ? "candidate" : "candidates"} not in a batch`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const oldestOffer = summary.offersWaiting.items[0]?.date ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{greeting.date}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting.title}</h1>
          {todayLine ? <p className="text-sm text-muted-foreground">{todayLine}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <NewBatchButton openOnDashboard />
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
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Briefcase} label="Open jobs" value={summary.openJobs} hint="Taking applications" href="/admin/recruitment/jobs" />
        <Stat
          icon={Users}
          label="Candidates in progress"
          value={summary.inProgress}
          hint={summary.newCandidates.count > 0 ? `${summary.newCandidates.count} not in a batch` : "All in batches"}
          href="/admin/recruitment/pipeline"
        />
        <Stat
          icon={Send}
          label="Offers waiting for reply"
          value={summary.offersWaiting.count}
          hint={oldestOffer ? `Oldest sent ${inSentence(oldestOffer)}` : "None waiting"}
          href="/admin/recruitment/offers"
          attention={summary.offersWaiting.count > 0}
        />
        <Stat
          icon={UserCheck}
          label="Ready to join"
          value={summary.readyToJoin.count}
          hint={summary.readyToJoin.count > 0 ? "Make them employees" : "No one waiting"}
          href="/admin/recruitment/conversions"
          attention={summary.readyToJoin.count > 0}
        />
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold">Batches</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{batches.length}</span>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-sm">
            <Link
              href="/admin/recruitment"
              scroll={false}
              className={cn("rounded-md px-3 py-1", !showClosed ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              Open
            </Link>
            <Link
              href="/admin/recruitment?show=closed"
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
            <p className="font-medium">{showClosed ? "No closed batches yet" : "No open batches"}</p>
            {!showClosed ? (
              <>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Make a batch for an interview date, then add the candidates you are calling that day.
                </p>
                <NewBatchButton openOnDashboard />
              </>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.flatMap((group) =>
              group.items.map((batch) => (
                <BatchBox key={batch.id} batch={batch} highlight={group.id === "today"} onOpen={() => openBatch(batch.id)} />
              ))
            )}
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <PeopleList
          title="New candidates"
          hint="Not in a batch yet"
          count={summary.newCandidates.count}
          items={summary.newCandidates.items}
          allHref="/admin/recruitment/pipeline"
          empty="Everyone is in a batch."
          datePrefix="Applied"
        />
        <PeopleList
          title="Offers waiting for reply"
          hint="Sent, no answer yet"
          count={summary.offersWaiting.count}
          items={summary.offersWaiting.items}
          allHref="/admin/recruitment/offers"
          empty="No offers waiting."
          datePrefix="Sent"
        />
        <PeopleList
          title="Ready to join"
          hint="Offer accepted, not an employee yet"
          count={summary.readyToJoin.count}
          items={summary.readyToJoin.items}
          allHref="/admin/recruitment/conversions"
          empty="No one waiting to join."
          datePrefix="Accepted"
          action="Make employee"
        />
      </div>

      {sheet ? (
        <BatchOverlay
          sheet={sheet}
          panelOpen={searchParams.has("applicationId")}
          onClose={() => openBatch(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
  attention = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  href: string;
  /** A small dot when the number needs following up. */
  attention?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-foreground/20 hover:shadow-md"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="h-4 w-4" />
        {attention ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-card" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none tabular-nums">{value}</span>
        <span className="mt-1 block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}

function PeopleList({
  title,
  hint,
  count,
  items,
  allHref,
  empty,
  datePrefix,
  action,
}: {
  title: string;
  hint: string;
  count: number;
  items: DashboardPerson[];
  allHref: string;
  empty: string;
  datePrefix: string;
  action?: string;
}) {
  return (
    <section className="flex flex-col self-start rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            {title} <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        {count > items.length ? (
          <Link href={allHref} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
            See all
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
          <Check className="h-4 w-4" aria-hidden />
          {empty}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={p.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.role}
                    {p.date ? ` · ${datePrefix} ${inSentence(p.date)}` : ""}
                  </span>
                </span>
                {action ? (
                  <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium">{action}</span>
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BatchBox({
  batch,
  highlight,
  onOpen,
  showManagers = true,
}: {
  batch: BatchListItem;
  highlight: boolean;
  onOpen: () => void;
  /** HR sees who the batch is shared with. */
  showManagers?: boolean;
}) {
  const total = batch.candidateCount;
  const decided = decidedCount(batch.progress);
  const percent = total > 0 ? Math.round((decided / total) * 100) : 0;
  const allDecided = total > 0 && decided === total;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        highlight ? "border-foreground/30 shadow-sm" : "border-border hover:border-foreground/20"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {batch.interviewDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              highlight ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3 w-3" aria-hidden />
            {dayLabel(batch.interviewDate)}
          </span>
        ) : (
          <span />
        )}
        {allDecided ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" aria-hidden />
            All decided
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold tracking-tight">{batch.code}</p>
          <p className="truncate text-sm text-muted-foreground">{batch.name ?? "No name"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold leading-none tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-muted-foreground">candidate{total === 1 ? "" : "s"}</p>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground group-hover:text-foreground">No candidates yet. Click to add them.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/70" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {decided} of {total} decided
            {batch.progress.hire > 0 ? ` · ${batch.progress.hire} hired` : ""}
          </p>
        </div>
      )}
      {showManagers && batch.managers.length > 0 ? (
        <p className="truncate border-t border-border pt-2 text-xs text-muted-foreground">
          Shared with {batch.managers.map((m) => m.name).join(", ")}
        </p>
      ) : null}
    </button>
  );
}

/** The batch on top of the dashboard. The candidate review panel opens over it. */
export function BatchOverlay({
  sheet,
  panelOpen,
  mode = "hr",
  onClose,
}: {
  sheet: BatchSheet;
  panelOpen: boolean;
  mode?: "hr" | "manager";
  onClose: () => void;
}) {
  // Rendered on <body> so it covers the side menu too.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [panelOpen]);

  useEffect(() => {
    if (panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Leave Escape to a dialog opened from inside the batch (Add candidates and so on).
      if (e.key !== "Escape" || document.querySelector('[role="dialog"][data-state="open"]')) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={`Batch ${sheet.code}`}>
      <button type="button" aria-label="Back to dashboard" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-full w-full max-w-7xl flex-col overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to dashboard"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <BatchSheetView sheet={sheet} variant="overlay" mode={mode} />
      </div>
    </div>,
    document.body
  );
}
