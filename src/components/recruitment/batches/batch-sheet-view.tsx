"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Eye, FileText, Layers, MessageSquare, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { StarRatingDisplay } from "@/components/recruitment/interviews/star-rating";
import { BatchProgressLegend } from "@/components/recruitment/batches/batch-progress-legend";
import { CandidateReviewPanel } from "@/components/recruitment/applications/candidate-review-panel";
import { AddCandidatesButton } from "@/components/recruitment/batches/add-candidates-button";
import { ShareBatchButton } from "@/components/recruitment/batches/share-batch-button";
import {
  renameBatchAction,
  setBatchInterviewDateAction,
  setBatchStatusAction,
} from "@/actions/recruitment-batches";
import type { BatchSheet, BatchSheetRow } from "@/lib/recruitment/batch/batch-service";
import type { BatchBucket } from "@/lib/recruitment/batch/batch-progress";
import { formatCtc, formatInterviewDate } from "@/lib/recruitment/batch/batch-membership";
import { cn } from "@/lib/utils";

type SortKey = "slNo" | "name" | "role" | "experienceYears" | "currentCtc" | "hrStars" | "education" | "noticePeriod" | "stageLabel";

/** Sl.no, Name, Role, Experience, CTC, HR ★, Education, Notice, Resume, Stage. */
const COLUMN_COUNT = 10;

function compare(a: BatchSheetRow, b: BatchSheetRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  // Blanks always sort last, whichever direction.
  if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
  if (bv == null || bv === "") return -1;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
}

function formatExperience(years: number | null): string | null {
  if (years == null) return null;
  if (years === 0) return "Fresher";
  return `${years} yr${years === 1 ? "" : "s"}`;
}

export function BatchSheetView({
  sheet,
  variant = "page",
  mode = "hr",
}: {
  sheet: BatchSheet;
  /** "manager": a manager HR shared the batch with. Read-only header, Manager Round steps in the panel. */
  mode?: "hr" | "manager";
  /** "overlay" is the dashboard's pop-up: no back link, the table fits the overlay. */
  variant?: "page" | "overlay";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [confirmClose, setConfirmClose] = useState(false);
  const [bucket, setBucket] = useState<BatchBucket | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "slNo", dir: "asc" });
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isOpen = sheet.status === "open";
  const isManager = mode === "manager";

  const rows = useMemo(() => {
    // The stage chips above the table are the only filter.
    const filtered = bucket ? sheet.rows.filter((r) => r.bucket === bucket) : sheet.rows;
    const sorted = filtered.slice().sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [sheet.rows, bucket, sort]);

  const setPanel = useCallback(
    (applicationId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (applicationId) params.set("applicationId", applicationId);
      else params.delete("applicationId");
      params.delete("tab");
      const qs = params.toString();
      // Only the address changes: the panel loads its own details, so the
      // next person opens at once instead of after a page reload.
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, searchParams]
  );

  const openId = searchParams.get("applicationId");
  const order = rows.map((r) => r.applicationId);
  const openIndex = openId ? order.indexOf(openId) : -1;
  const openRow = openId ? (sheet.rows.find((r) => r.applicationId === openId) ?? null) : null;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  /** Batch actions refresh the sheet themselves; pass refresh for actions from elsewhere. */
  function run(
    action: () => Promise<{ error?: string; success?: string }>,
    options: { after?: () => void; refresh?: boolean } = {}
  ) {
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        setNotice({ tone: "error", text: res.error });
        return;
      }
      if (res.success) setNotice({ tone: "ok", text: res.success });
      options.after?.();
      if (options.refresh) router.refresh();
    });
  }

  const columnCount = COLUMN_COUNT;

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="space-y-3">
        {variant === "page" ? (
          <Link
            href="/admin/recruitment/batches"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Batches
          </Link>
        ) : null}
        <div className={cn("flex flex-wrap items-start justify-between gap-3", variant === "overlay" && "pr-10")}>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{sheet.code}</h1>
              {isManager ? (
                sheet.name ? <span className="text-lg text-muted-foreground">{sheet.name}</span> : null
              ) : (
                <BatchName batchId={sheet.id} name={sheet.name} />
              )}
              {!isOpen ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Closed</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <InterviewDate batchId={sheet.id} value={sheet.interviewDate} editable={isOpen && !isManager} />
              <span>
                {sheet.rows.length} candidate{sheet.rows.length === 1 ? "" : "s"} · created{" "}
                {new Date(sheet.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                {sheet.createdByName ? ` by ${sheet.createdByName}` : ""}
              </span>
              {!isManager && sheet.managers.length > 0 ? (
                <span>Shared with {sheet.managers.map((m) => m.name).join(", ")}</span>
              ) : null}
            </div>
          </div>
          {isManager ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {isOpen ? <AddCandidatesButton batchId={sheet.id} batchCode={sheet.code} /> : null}
            <ShareBatchButton batchId={sheet.id} batchCode={sheet.code} sharedCount={sheet.managers.length} />
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                isOpen ? setConfirmClose(true) : run(() => setBatchStatusAction({ batchId: sheet.id, status: "open" }))
              }
            >
              {isOpen ? "Close batch" : "Reopen batch"}
            </Button>
            <AlertDialog
              isOpen={confirmClose}
              onOpenChange={setConfirmClose}
              title={`Close ${sheet.code}?`}
              description={closeBatchMessage(sheet)}
              actionLabel="Close batch"
              isPending={isPending}
              onAction={() =>
                run(() => setBatchStatusAction({ batchId: sheet.id, status: "closed" }), {
                  after: () => setConfirmClose(false),
                })
              }
            />
          </div>
          )}
        </div>
      </div>

      {/* Everyone decided: offer to close, with the outcome. */}
      {isOpen && !isManager && sheet.rows.length > 0 && sheet.progress.hr_round + sheet.progress.manager_round === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-muted px-4 py-3 text-sm">
          <span className="text-success">
            <span className="font-medium">Everyone in this batch is decided.</span>{" "}
            {[
              sheet.progress.hire > 0 ? `${sheet.progress.hire} hired` : null,
              sheet.progress.rejected > 0 ? `${sheet.progress.rejected} rejected` : null,
              sheet.progress.on_hold > 0 ? `${sheet.progress.on_hold} on hold` : null,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </span>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmClose(true)}>
            Close batch
          </Button>
        </div>
      ) : null}

      {/* Progress */}
      {sheet.rows.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <BatchProgressLegend progress={sheet.progress} active={bucket} onSelect={setBucket} />
        </div>
      ) : null}

      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
            notice.tone === "error" ? "border-danger/30 bg-danger-muted text-danger" : "border-success/30 bg-success-muted text-success"
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {sheet.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Layers className="h-8 w-8 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">No candidates in this batch yet</p>
            <p className="text-sm text-muted-foreground">
              Add the candidates for this interview here, or tick them on the Pipeline list and choose Add to batch.
            </p>
          </div>
          {isOpen ? <AddCandidatesButton batchId={sheet.id} batchCode={sheet.code} /> : null}
        </div>
      ) : (
        <>
          {bucket ? (
            <p className="text-xs text-muted-foreground">
              Showing {rows.length} of {sheet.rows.length}.{" "}
              <button type="button" className="underline" onClick={() => setBucket(null)}>
                Show everyone
              </button>
            </p>
          ) : null}

          <div
            className={cn(
              "overflow-auto rounded-xl border border-border bg-card",
              variant === "overlay" ? "max-h-[calc(100vh-19rem)]" : "max-h-[calc(100vh-15rem)]"
            )}
          >
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 z-20 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <SortHeader label="Sl.no" k="slNo" sort={sort} onSort={toggleSort} className="w-14 text-right" />
                  <SortHeader label="Name" k="name" sort={sort} onSort={toggleSort} className="sticky left-0 z-30 min-w-44 bg-muted" />
                  <SortHeader label="Applied role" k="role" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Experience" k="experienceYears" sort={sort} onSort={toggleSort} className="min-w-52" />
                  <SortHeader label="CTC (current / expected)" k="currentCtc" sort={sort} onSort={toggleSort} />
                  <SortHeader label="HR ★" k="hrStars" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Education" k="education" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Notice period" k="noticePeriod" sort={sort} onSort={toggleSort} />
                  <th className="border-b border-border px-3 py-2 font-medium">Resume</th>
                  <SortHeader label="Stage" k="stageLabel" sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isActive = openId === r.applicationId;
                  const cell = "border-b border-border px-3 py-2 align-top";
                  const stickyBg = isActive ? "bg-accent-blue-muted" : "bg-card group-hover:bg-muted/60";
                  const current = formatCtc(r.currentCtc);
                  const expected = formatCtc(r.expectedCtc);
                  return (
                    <tr
                      key={r.memberId}
                      className={cn("group", isActive ? "bg-accent-blue-muted" : "hover:bg-muted/60")}
                    >
                      <td className={cn(cell, "text-right tabular-nums text-muted-foreground")}>{r.slNo}</td>
                      <td className={cn(cell, "sticky left-0 z-10", stickyBg)}>
                        <span className="flex items-center gap-1.5">
                          {isManager ? (
                            <button
                              type="button"
                              onClick={() => setPanel(r.applicationId)}
                              className="text-left font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                            >
                              {r.name}
                            </button>
                          ) : (
                            <Link
                              href={`/admin/recruitment/candidates/${r.candidateId}`}
                              className="font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                            >
                              {r.name}
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setPanel(r.applicationId)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Quick view"
                            aria-label={`Quick view of ${r.name}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {r.commentCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setPanel(r.applicationId)}
                              className="inline-flex items-center gap-0.5 rounded px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={`${r.commentCount} comment${r.commentCount === 1 ? "" : "s"}`}
                              aria-label={`${r.commentCount} comments on ${r.name}`}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {r.commentCount}
                            </button>
                          ) : null}
                        </span>
                      </td>
                      <td className={cn(cell, "whitespace-nowrap")}>
                        {isManager ? (
                          r.role
                        ) : (
                          <Link href={`/admin/recruitment/jobs/${r.jobOpeningId}`} className="text-accent-blue hover:underline">
                            {r.role}
                          </Link>
                        )}
                      </td>
                      <td className={cell}>
                        <ExperienceCell years={r.experienceYears} experiences={r.experiences} />
                      </td>
                      <td className={cn(cell, "whitespace-nowrap tabular-nums")}>
                        {current || expected ? (
                          <>
                            {current ?? <Blank />}
                            <span className="text-muted-foreground"> / </span>
                            {expected ?? <Blank />}
                          </>
                        ) : (
                          <Blank />
                        )}
                      </td>
                      <td className={cn(cell, "whitespace-nowrap")}>
                        {r.hrStars != null ? (
                          <StarRatingDisplay value={r.hrStars} size="xs" showNumber />
                        ) : (
                          <span className="text-muted-foreground" title="No HR round scorecard yet">
                            —
                          </span>
                        )}
                      </td>
                      <td className={cell}>{r.education ?? <Blank />}</td>
                      <td className={cn(cell, "whitespace-nowrap")}>{r.noticePeriod ?? <Blank />}</td>
                      <td className={cn(cell, "whitespace-nowrap")}>
                        {r.resume ? (
                          <a
                            href={`/api/recruitment/documents/preview?id=${encodeURIComponent(r.resume.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent-blue hover:underline"
                            title={r.resume.fileName}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Resume
                          </a>
                        ) : (
                          <Blank />
                        )}
                      </td>
                      <td className={cn(cell, "whitespace-nowrap")}>
                        {r.stageLabel}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No one here.{" "}
                      <button type="button" className="underline" onClick={() => setBucket(null)}>
                        Show everyone
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {isManager
              ? "Click a name to see the candidate. In that panel, J and K move to the next and previous person."
              : "Click a name to open the candidate's profile, or the eye icon to see them without leaving the batch. In that panel, J and K move to the next and previous person."}
          </p>
        </>
      )}

      <CandidateReviewPanel
        facts={openRow}
        batch={openRow && !isManager ? { batchId: sheet.id, memberId: openRow.memberId } : undefined}
        mode={mode}
        application={null}
        open={Boolean(openId)}
        onClose={() => setPanel(null)}
        prevId={openIndex > 0 ? order[openIndex - 1] : null}
        nextId={openIndex >= 0 && openIndex < order.length - 1 ? order[openIndex + 1] : null}
        onNavigate={(id) => setPanel(id)}
        editable={isOpen}
      />
    </div>
  );
}

/** What closing does, and who is still waiting if anyone is. */
function closeBatchMessage(sheet: BatchSheet): string {
  const waiting = sheet.progress.hr_round + sheet.progress.manager_round;
  const base = "It moves to Closed batches. You can reopen it any time.";
  if (waiting === 0) return base;
  return `${waiting} ${waiting === 1 ? "person is" : "people are"} still in HR Round or Manager Round. ${base}`;
}

function Blank() {
  return <span className="text-muted-foreground/60">—</span>;
}

function ExperienceCell({ years, experiences }: { years: number | null; experiences: BatchSheetRow["experiences"] }) {
  const total = formatExperience(years);
  if (!total && experiences.length === 0) return <Blank />;
  return (
    <div className="space-y-0.5">
      {total ? <div className="font-medium tabular-nums">{total}</div> : null}
      {experiences.slice(0, 3).map((e, i) => (
        <div key={i} className="text-xs text-muted-foreground">
          <span className="text-foreground">{e.company}</span>
          {e.role ? ` · ${e.role}` : ""}
          {e.current ? " (current)" : ""}
        </div>
      ))}
      {experiences.length > 3 ? <div className="text-xs text-muted-foreground">+{experiences.length - 3} more</div> : null}
    </div>
  );
}

function InterviewDate({ batchId, value, editable }: { batchId: string; value: Date | null; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const iso = value ? new Date(value).toISOString().slice(0, 10) : "";

  function save(next: string) {
    setEditing(false);
    if (!next || next === iso) return;
    startTransition(async () => {
      const res = await setBatchInterviewDateAction({ batchId, interviewDate: next });
      setError(res.error ?? null);
      if (!res.error) router.refresh();
    });
  }

  if (editing) {
    return (
      <Input
        type="date"
        defaultValue={iso}
        autoFocus
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-8 w-44"
        aria-label="Interview date"
      />
    );
  }
  return (
    <button
      type="button"
      disabled={!editable || isPending}
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1.5 font-medium text-foreground disabled:cursor-default"
      title={error ?? (editable ? "Change interview date" : undefined)}
    >
      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {formatInterviewDate(value) ? `Interview ${formatInterviewDate(value)}` : <span className="text-muted-foreground">Set interview date</span>}
      {editable ? <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /> : null}
      {error ? <span className="text-xs text-danger">Not saved</span> : null}
    </button>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("whitespace-nowrap border-b border-border px-3 py-2 font-medium", className)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
      >
        {label}
        {active ? <Icon className="h-3 w-3" /> : null}
      </button>
    </th>
  );
}

function BatchName({ batchId, name }: { batchId: string; name: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const next = draft.trim();
    setEditing(false);
    if (next === (name ?? "")) return;
    startTransition(async () => {
      await renameBatchAction({ batchId, name: next || null });
      router.refresh();
    });
  }

  if (editing) {
    return (
      <Input
        value={draft}
        autoFocus
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(name ?? "");
            setEditing(false);
          }
        }}
        className="h-9 w-72 text-base"
        aria-label="Batch name"
        placeholder="Batch name"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={isPending}
      className="group inline-flex items-center gap-1.5 text-lg text-muted-foreground hover:text-foreground"
    >
      {name ?? <span className="text-base">Add a name</span>}
      <Pencil className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      <span className="sr-only">Rename batch</span>
    </button>
  );
}
