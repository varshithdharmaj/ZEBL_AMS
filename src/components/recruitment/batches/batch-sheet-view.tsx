"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Columns3, FileText, Layers, Pencil, Search, X } from "lucide-react";
import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ApplicationPipelineDrawer,
  type PipelineDrawerApplication,
  type PipelineDrawerTab,
} from "@/components/recruitment/applications/application-pipeline-drawer";
import { StarRatingDisplay } from "@/components/recruitment/interviews/star-rating";
import { BatchProgressBar, BatchProgressLegend } from "@/components/recruitment/batches/batch-progress-bar";
import {
  removeBatchMembersAction,
  renameBatchAction,
  setBatchInterviewDateAction,
  setBatchStatusAction,
  updateBatchRemarksAction,
} from "@/actions/recruitment-batches";
import { bulkMoveApplicationsStageAction } from "@/actions/recruitment-applications";
import type { BatchSheet, BatchSheetRow } from "@/lib/recruitment/batch/batch-service";
import { BATCH_BUCKETS, type BatchBucket } from "@/lib/recruitment/batch/batch-progress";
import { formatCtc, formatInterviewDate } from "@/lib/recruitment/batch/batch-membership";
import { cn } from "@/lib/utils";

type SortKey = "slNo" | "name" | "role" | "experienceYears" | "currentCtc" | "hrStars" | "education" | "noticePeriod" | "stageLabel";

const MOVE_OPTIONS = [
  { stage: RecruitmentPipelineStage.hr_round, label: "HR Round" },
  { stage: RecruitmentPipelineStage.manager_round, label: "Manager Round" },
  { stage: RecruitmentPipelineStage.decision, label: "Selected" },
] as const;

const EXTRA_COLUMNS = [
  { id: "email", label: "Email ID" },
  { id: "phone", label: "Phone Number" },
  { id: "location", label: "Current Location" },
] as const;
type ExtraColumnId = (typeof EXTRA_COLUMNS)[number]["id"];

/** Checkbox, Sl.no, Name, Role, Experience, CTC, HR ★, Education, Notice, Resume, Stage, Remarks. */
const BASE_COLUMNS = 12;

const BUCKET_DOT = Object.fromEntries(BATCH_BUCKETS.map((b) => [b.id, b.dotClass])) as Record<BatchBucket, string>;

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
  selectedApplication,
  initialTab,
}: {
  sheet: BatchSheet;
  selectedApplication: PipelineDrawerApplication | null;
  initialTab: PipelineDrawerTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<BatchBucket | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "slNo", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Set<ExtraColumnId>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isOpen = sheet.status === "open";
  const show = (id: ExtraColumnId) => extras.has(id);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const filtered = sheet.rows.filter((r) => {
      if (bucket && r.bucket !== bucket) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)) ||
        r.role.toLowerCase().includes(q) ||
        r.experiences.some((e) => e.company.toLowerCase().includes(q)) ||
        (r.remarks ?? "").toLowerCase().includes(q)
      );
    });
    const sorted = filtered.slice().sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [sheet.rows, query, bucket, sort]);

  // Drop selections that are no longer in the batch after a refresh.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(sheet.rows.map((r) => r.memberId));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sheet.rows]);

  const setPanel = useCallback(
    (applicationId: string | null, tab?: PipelineDrawerTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (applicationId) params.set("applicationId", applicationId);
      else params.delete("applicationId");
      if (applicationId && tab && tab !== "overview") params.set("tab", tab);
      else params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const openId = searchParams.get("applicationId");
  const order = rows.map((r) => r.applicationId);
  const openIndex = openId ? order.indexOf(openId) : -1;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function toggleExtra(id: ExtraColumnId) {
    setExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allShownSelected = rows.length > 0 && rows.every((r) => selected.has(r.memberId));
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) rows.forEach((r) => next.delete(r.memberId));
      else rows.forEach((r) => next.add(r.memberId));
      return next;
    });
  }
  function toggleOne(memberId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  const selectedRows = sheet.rows.filter((r) => selected.has(r.memberId));

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

  const columnCount = BASE_COLUMNS + extras.size;

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="space-y-3">
        <Link
          href="/admin/recruitment/batches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Batches
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{sheet.code}</h1>
              <BatchName batchId={sheet.id} name={sheet.name} />
              {!isOpen ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Closed</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <InterviewDate batchId={sheet.id} value={sheet.interviewDate} editable={isOpen} />
              <span>
                {sheet.rows.length} candidate{sheet.rows.length === 1 ? "" : "s"} · created{" "}
                {new Date(sheet.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                {sheet.createdByName ? ` by ${sheet.createdByName}` : ""}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOpen ? (
              <Button asChild variant="outline">
                <Link href="/admin/recruitment/pipeline?view=list">
                  <Layers className="h-4 w-4" />
                  Add candidates
                </Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                run(() => setBatchStatusAction({ batchId: sheet.id, status: isOpen ? "closed" : "open" }))
              }
            >
              {isOpen ? "Close batch" : "Reopen batch"}
            </Button>
          </div>
        </div>
      </div>

      {/* Progress */}
      {sheet.rows.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <BatchProgressBar progress={sheet.progress} total={sheet.rows.length} className="h-2.5" />
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
              On the Pipeline list, tick the candidates for this interview and choose Add to batch.
            </p>
          </div>
          {isOpen ? (
            <Button asChild>
              <Link href="/admin/recruitment/pipeline?view=list">Go to Pipeline list</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Toolbar: search, or actions for selected rows */}
          <div className="flex min-h-10 flex-wrap items-center gap-2">
            {selectedRows.length > 0 ? (
              <SelectionBar
                count={selectedRows.length}
                disabled={isPending}
                onMove={(stage) =>
                  run(
                    () => bulkMoveApplicationsStageAction({}, { ids: selectedRows.map((r) => r.applicationId), stage }),
                    { after: () => setSelected(new Set()), refresh: true }
                  )
                }
                onRemove={() =>
                  run(
                    () => removeBatchMembersAction({ batchId: sheet.id, memberIds: selectedRows.map((r) => r.memberId) }),
                    { after: () => setSelected(new Set()) }
                  )
                }
                onClear={() => setSelected(new Set())}
              />
            ) : (
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, role, company"
                  className="h-9 pl-8"
                  aria-label="Search this batch"
                />
              </div>
            )}
            {(query || bucket) && selectedRows.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Showing {rows.length} of {sheet.rows.length}
              </span>
            ) : null}
            <Popover
              open={columnsOpen}
              onOpenChange={setColumnsOpen}
              align="end"
              className="ml-auto"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={columnsOpen}
                  onClick={() => setColumnsOpen((open) => !open)}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                  {extras.size > 0 ? <span className="text-muted-foreground">{extras.size}</span> : null}
                </Button>
              }
            >
              <div className="space-y-2 p-1">
                <p className="px-1 text-xs font-medium text-muted-foreground">More columns</p>
                {EXTRA_COLUMNS.map((col) => (
                  <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted">
                    <Checkbox checked={extras.has(col.id)} onCheckedChange={() => toggleExtra(col.id)} aria-label={col.label} />
                    {col.label}
                  </label>
                ))}
              </div>
            </Popover>
          </div>

          <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-xl border border-border bg-card">
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 z-20 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-30 w-10 border-b border-border bg-muted px-3 py-2">
                    <Checkbox checked={allShownSelected} onCheckedChange={toggleAll} aria-label="Select all shown" />
                  </th>
                  <SortHeader label="Sl.no" k="slNo" sort={sort} onSort={toggleSort} className="w-14 text-right" />
                  <SortHeader label="Name" k="name" sort={sort} onSort={toggleSort} className="sticky left-10 z-30 min-w-44 bg-muted" />
                  <SortHeader label="Applied role" k="role" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Experience" k="experienceYears" sort={sort} onSort={toggleSort} className="min-w-52" />
                  <SortHeader label="CTC (current / expected)" k="currentCtc" sort={sort} onSort={toggleSort} />
                  <SortHeader label="HR ★" k="hrStars" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Education" k="education" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Notice period" k="noticePeriod" sort={sort} onSort={toggleSort} />
                  <th className="border-b border-border px-3 py-2 font-medium">Resume</th>
                  <SortHeader label="Stage" k="stageLabel" sort={sort} onSort={toggleSort} />
                  <th className="min-w-56 border-b border-border px-3 py-2 font-medium">Remarks</th>
                  {show("email") ? <th className="border-b border-border px-3 py-2 font-medium">Email ID</th> : null}
                  {show("phone") ? <th className="border-b border-border px-3 py-2 font-medium">Phone Number</th> : null}
                  {show("location") ? <th className="border-b border-border px-3 py-2 font-medium">Current Location</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSelected = selected.has(r.memberId);
                  const isActive = openId === r.applicationId;
                  const cell = "border-b border-border px-3 py-2 align-top";
                  const stickyBg = isActive ? "bg-accent-blue-muted" : isSelected ? "bg-muted" : "bg-card group-hover:bg-muted/60";
                  const current = formatCtc(r.currentCtc);
                  const expected = formatCtc(r.expectedCtc);
                  return (
                    <tr
                      key={r.memberId}
                      className={cn("group", isActive ? "bg-accent-blue-muted" : isSelected ? "bg-muted" : "hover:bg-muted/60")}
                    >
                      <td className={cn(cell, "sticky left-0 z-10", stickyBg)}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(r.memberId)} aria-label={`Select ${r.name}`} />
                      </td>
                      <td className={cn(cell, "text-right tabular-nums text-muted-foreground")}>{r.slNo}</td>
                      <td className={cn(cell, "sticky left-10 z-10", stickyBg)}>
                        <button
                          type="button"
                          onClick={() => setPanel(r.applicationId)}
                          className="text-left font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className={cn(cell, "whitespace-nowrap")}>
                        <Link href={`/admin/recruitment/jobs/${r.jobOpeningId}`} className="text-accent-blue hover:underline">
                          {r.role}
                        </Link>
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
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", BUCKET_DOT[r.bucket])} aria-hidden />
                          {r.stageLabel}
                        </span>
                      </td>
                      <td className={cn(cell, "p-0")}>
                        <RemarksCell memberId={r.memberId} value={r.remarks} editable={isOpen} />
                      </td>
                      {show("email") ? (
                        <td className={cn(cell, "max-w-56 truncate")} title={r.email ?? undefined}>
                          {r.email ?? <Blank />}
                        </td>
                      ) : null}
                      {show("phone") ? (
                        <td className={cn(cell, "whitespace-nowrap tabular-nums")}>
                          {r.phone ? (
                            <a href={`tel:${r.phone}`} className="hover:underline">
                              {r.phone}
                            </a>
                          ) : (
                            <Blank />
                          )}
                        </td>
                      ) : null}
                      {show("location") ? <td className={cell}>{r.location ?? <Blank />}</td> : null}
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No candidates match.{" "}
                      <button type="button" className="underline" onClick={() => { setQuery(""); setBucket(null); }}>
                        Clear search
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Click a name to see the candidate without leaving the batch. In the panel, J and K move to the next and previous person.
          </p>
        </>
      )}

      <ApplicationPipelineDrawer
        application={openId ? selectedApplication : null}
        open={Boolean(openId)}
        onClose={() => setPanel(null)}
        prevId={openIndex > 0 ? order[openIndex - 1] : null}
        nextId={openIndex >= 0 && openIndex < order.length - 1 ? order[openIndex + 1] : null}
        onNavigate={(id) => setPanel(id)}
        initialTab={initialTab}
      />
    </div>
  );
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

function SelectionBar({
  count,
  disabled,
  onMove,
  onRemove,
  onClear,
}: {
  count: number;
  disabled: boolean;
  onMove: (stage: RecruitmentPipelineStage) => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 4000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
      <span className="px-1 text-sm font-medium">{count} selected</span>
      <Select value="" onValueChange={(v) => onMove(v as RecruitmentPipelineStage)} disabled={disabled}>
        <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Move selected to stage">
          <SelectValue placeholder="Move to…" />
        </SelectTrigger>
        <SelectContent>
          {MOVE_OPTIONS.map((o) => (
            <SelectItem key={o.stage} value={o.stage}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={confirmRemove ? "destructive" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => {
          if (confirmRemove) {
            setConfirmRemove(false);
            onRemove();
          } else {
            setConfirmRemove(true);
          }
        }}
      >
        {confirmRemove ? `Yes, remove ${count}` : "Remove from batch"}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

/** Click to edit; Enter or clicking away saves, Shift+Enter adds a line, Esc cancels. */
function RemarksCell({ memberId, value, editable }: { memberId: string; value: string | null; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saved, setSaved] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Take the server's value when it changes (after a save or a refresh), not on every edit toggle.
  const editingRef = useRef(editing);
  editingRef.current = editing;
  useEffect(() => {
    if (editingRef.current) return;
    setSaved(value);
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (editing) {
      const el = ref.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  async function save() {
    const next = draft.trim();
    setEditing(false);
    if (next === (saved ?? "")) return;
    const previous = saved;
    setSaved(next || null);
    setState("saving");
    const res = await updateBatchRemarksAction({ memberId, remarks: next || null });
    if (res.error) {
      setSaved(previous);
      setDraft(previous ?? "");
      setState("error");
      setError(res.error);
    } else {
      setState("idle");
      setError(null);
    }
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            setDraft(saved ?? "");
            setEditing(false);
          }
        }}
        rows={Math.min(6, Math.max(2, draft.split("\n").length))}
        maxLength={2000}
        className="block w-full min-w-56 resize-y bg-background px-3 py-2 text-[13px] outline-none ring-2 ring-inset ring-ring/40"
        aria-label="Remarks"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => setEditing(true)}
      className={cn(
        "group/remark block h-full min-h-9 w-full min-w-56 px-3 py-2 text-left",
        editable && "cursor-text hover:bg-muted/80",
        state === "error" && "bg-danger-muted"
      )}
      title={error ?? (editable ? "Click to edit" : undefined)}
    >
      {saved ? (
        <span className="line-clamp-3 whitespace-pre-line">{saved}</span>
      ) : editable ? (
        <span className="text-muted-foreground/60 opacity-0 group-hover/remark:opacity-100">Add remark</span>
      ) : (
        <Blank />
      )}
      {state === "saving" ? <span className="ml-1 text-[11px] text-muted-foreground">Saving…</span> : null}
      {state === "error" ? <span className="block text-[11px] text-danger">Not saved. Click to try again.</span> : null}
    </button>
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
