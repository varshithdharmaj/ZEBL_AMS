"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Undo2 } from "lucide-react";
import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { CloseApplicationDialog } from "@/components/recruitment/applications/close-application-dialog";
import type {
  PipelineDrawerApplication,
  PipelineDrawerFeedback,
} from "@/components/recruitment/applications/application-pipeline-drawer";
import { FeedbackScorecardDetails } from "@/components/recruitment/interviews/scorecard-summary";
import { StarRatingDisplay } from "@/components/recruitment/interviews/star-rating";
import { moveApplicationStageAction, reopenApplicationAction } from "@/actions/recruitment-applications";
import type { BatchSheetRow } from "@/lib/recruitment/batch/batch-service";
import { formatCtc } from "@/lib/recruitment/batch/batch-membership";

type Step = { label: string; stage: RecruitmentPipelineStage; done: string };

const TO_MANAGER: Step = { label: "Send to Manager Round", stage: RecruitmentPipelineStage.manager_round, done: "sent to Manager Round" };
const HIRE: Step = { label: "Hire", stage: RecruitmentPipelineStage.decision, done: "marked Hire" };
const HOLD: Step = { label: "Hold", stage: RecruitmentPipelineStage.on_hold, done: "put on hold" };
const BACK_TO_HR: Step = { label: "Back to HR Round", stage: RecruitmentPipelineStage.hr_round, done: "moved back to HR Round" };
const BACK_TO_MANAGER: Step = { label: "Back to Manager Round", stage: RecruitmentPipelineStage.manager_round, done: "moved back to Manager Round" };

/** What was just done, so it can be undone from the panel. */
type LastAction = { text: string; undo: () => Promise<{ error?: string }> };

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

/**
 * The batch's own side panel: the paper-plan facts and resume, and one-click
 * steps that follow the paper flow — HR Round → Manager Round → Hire / Reject
 * / Hold. After each step the next person opens, with Undo for the last one.
 */
export function BatchReviewPanel({
  row,
  application,
  open,
  onClose,
  prevId,
  nextId,
  onNavigate,
  editable,
}: {
  row: BatchSheetRow | null;
  application: PipelineDrawerApplication | null;
  open: boolean;
  onClose: () => void;
  prevId: string | null;
  nextId: string | null;
  onNavigate: (applicationId: string) => void;
  /** False for a closed batch: the panel only shows. */
  editable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [last, setLast] = useState<LastAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const applicationId = row?.applicationId;
  useEffect(() => setError(null), [applicationId]);

  // J / K: next / previous person. Esc closes (handled by the sheet).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (rejectOpen || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "j" && nextId) onNavigate(nextId);
      else if (key === "k" && prevId) onNavigate(prevId);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, nextId, prevId, onNavigate, rejectOpen]);

  if (!open) return null;

  if (!row) {
    return (
      <Sheet open={open} onClose={onClose} title="Candidate" description="This person is no longer in the batch.">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </Sheet>
    );
  }

  const name = row.name;
  const fromStage = row.stage as RecruitmentPipelineStage;

  /** Runs a step, then shows Undo and opens the next person. */
  function run(step: Step) {
    if (!row) return;
    const id = row.applicationId;
    setError(null);
    startTransition(async () => {
      const res = await moveApplicationStageAction({}, { id, stage: step.stage });
      if (res.error) {
        setError(res.error);
        return;
      }
      setLast({ text: `${name} ${step.done}.`, undo: () => moveApplicationStageAction({}, { id, stage: fromStage }) });
      router.refresh();
      if (nextId) onNavigate(nextId);
    });
  }

  function reopen() {
    if (!row) return;
    const id = row.applicationId;
    setError(null);
    startTransition(async () => {
      const res = await reopenApplicationAction({}, { id });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function undoLast() {
    if (!last) return;
    const action = last;
    startTransition(async () => {
      const res = await action.undo();
      if (res.error) setError(res.error);
      else {
        setLast(null);
        router.refresh();
      }
    });
  }

  const feedback: PipelineDrawerFeedback[] = application?.feedback ?? [];
  const resume = application?.resume ?? (row.resume ? { ...row.resume, mimeType: null } : null);
  const isPdf = resume ? (resume.mimeType ?? "").includes("pdf") || resume.fileName.toLowerCase().endsWith(".pdf") : false;
  const bucket = row.bucket;
  const latestOffer = application?.offers?.[0] ?? null;

  let steps: Step[] = [];
  let showReject = false;
  if (bucket === "hr_round") {
    steps = [TO_MANAGER];
    showReject = true;
  } else if (bucket === "manager_round") {
    steps = [HIRE];
    showReject = true;
  } else if (bucket === "on_hold") {
    steps = [BACK_TO_HR, BACK_TO_MANAGER];
  } else if (bucket === "hire" && row.stage !== "hired") {
    steps = [BACK_TO_MANAGER];
  }
  const showHold = bucket === "hr_round" || bucket === "manager_round";
  const isRejected = bucket === "rejected";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={name}
      description={row.role}
      headerActions={
        <>
          <Button type="button" variant="ghost" size="sm" disabled={!prevId} onClick={() => prevId && onNavigate(prevId)} title="Previous (K)" aria-label="Previous person">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={!nextId} onClick={() => nextId && onNavigate(nextId)} title="Next (J)" aria-label="Next person">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {last ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success-muted px-3 py-2 text-sm text-success">
            <span>{last.text}</span>
            <button type="button" onClick={undoLast} disabled={isPending} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-muted-foreground">Stage: </span>
            <span className="font-medium">{row.stageLabel}</span>
          </p>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              {bucket === "hire" && row.stage !== "hired" ? (
                latestOffer ? (
                  <Button asChild size="sm">
                    <Link href={`/admin/recruitment/offers/${latestOffer.id}`}>Open offer</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href={`/admin/recruitment/offers/new?applicationId=${row.applicationId}`}>Make offer</Link>
                  </Button>
                )
              ) : null}
              {steps.map((s, i) => (
                <Button key={s.label} size="sm" variant={i === 0 && !isRejected && bucket !== "hire" ? "default" : "outline"} disabled={isPending} onClick={() => run(s)}>
                  {s.label}
                </Button>
              ))}
              {showReject ? (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => setRejectOpen(true)} className="text-danger hover:text-danger">
                  Reject
                </Button>
              ) : null}
              {showHold ? (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(HOLD)}>
                  Hold
                </Button>
              ) : null}
              {isRejected ? (
                <Button size="sm" variant="outline" disabled={isPending} onClick={reopen}>
                  Reopen
                </Button>
              ) : null}
            </div>
          ) : null}
          {error ? <ErrorAlert message={error} /> : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Experience</dt>
            <dd>
              {row.experiences.length === 0
                ? "—"
                : row.experiences.slice(0, 3).map((e) => (
                    <div key={`${e.company}-${e.role}`}>
                      {e.company}
                      {e.role ? ` · ${e.role}` : ""}
                    </div>
                  ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">CTC (current / expected)</dt>
            <dd>
              {formatCtc(row.currentCtc) ?? "—"} / {formatCtc(row.expectedCtc) ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Notice period</dt>
            <dd>{row.noticePeriod ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">HR score</dt>
            <dd>{row.hrStars != null ? <StarRatingDisplay value={row.hrStars} size="xs" showNumber /> : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Manager score</dt>
            <dd>{row.managerStars != null ? <StarRatingDisplay value={row.managerStars} size="xs" showNumber /> : "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Education</dt>
            <dd>{row.education ?? "—"}</dd>
          </div>
        </dl>

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/admin/recruitment/candidates/${row.candidateId}`} className="text-accent-blue hover:underline">
            Full profile
          </Link>
          <Link href={`/admin/recruitment/pipeline?applicationId=${row.applicationId}`} className="text-accent-blue hover:underline">
            Open in Pipeline (offer, interviews, notes)
          </Link>
        </p>

        {resume ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resume</h3>
              <a
                href={`/api/recruitment/documents/preview?id=${encodeURIComponent(resume.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-accent-blue hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                Open in new tab
              </a>
            </div>
            {isPdf ? (
              <iframe
                title={`Resume of ${name}`}
                src={`/api/recruitment/documents/preview?id=${encodeURIComponent(resume.id)}`}
                className="h-[55vh] w-full rounded-lg border border-border bg-muted"
              />
            ) : null}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">No resume on file.</p>
        )}

        {feedback.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scorecards</h3>
            {feedback.map((f) => (
              <FeedbackScorecardDetails key={f.id} feedback={f} />
            ))}
          </section>
        ) : null}

        <p className="text-xs text-muted-foreground">J / K: next / previous person.</p>
      </div>

      <CloseApplicationDialog
        kind="reject"
        applicationId={row.applicationId}
        candidateName={name}
        jobTitle={row.role}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onDone={() => {
          const id = row.applicationId;
          setLast({ text: `${name} rejected.`, undo: () => reopenApplicationAction({}, { id }) });
          router.refresh();
          if (nextId) onNavigate(nextId);
        }}
      />
    </Sheet>
  );
}
