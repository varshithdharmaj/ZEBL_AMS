"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronLeft, ChevronRight, FileText, MoreHorizontal, Undo2 } from "lucide-react";
import { OfferStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { CloseApplicationDialog } from "@/components/recruitment/applications/close-application-dialog";
import { CloseReasonSummary } from "@/components/recruitment/applications/close-reason-summary";
import type {
  PipelineDrawerApplication,
  PipelineDrawerFeedback,
} from "@/components/recruitment/applications/application-pipeline-drawer";
import { FeedbackScorecardDetails } from "@/components/recruitment/interviews/scorecard-summary";
import { StarRatingDisplay } from "@/components/recruitment/interviews/star-rating";
import { BatchComments } from "@/components/recruitment/batches/batch-comments";
import { PanelRating } from "@/components/recruitment/batches/panel-rating";
import { forgetPanelDetails, usePanelDetails } from "@/components/recruitment/applications/use-panel-details";
import { moveApplicationStageAction, reopenApplicationAction } from "@/actions/recruitment-applications";
import { markHireAction } from "@/actions/recruitment-decisions";
import { removeBatchMembersAction } from "@/actions/recruitment-batches";
import type { CandidateFacts } from "@/lib/recruitment/batch/batch-service";
import { BATCH_BUCKETS, batchBucket, type BatchBucket } from "@/lib/recruitment/batch/batch-progress";
import { formatCtc } from "@/lib/recruitment/batch/batch-membership";
import { isFollowUpOverdue, offerStageLabel, type OfferTrackingView } from "@/lib/recruitment/offer/negotiation";
import { cn } from "@/lib/utils";

type Step = { label: string; stage: RecruitmentPipelineStage; done: string };

const TO_MANAGER: Step = { label: "Send to Manager Round", stage: RecruitmentPipelineStage.manager_round, done: "sent to Manager Round" };
const HIRE: Step = { label: "Hire", stage: RecruitmentPipelineStage.decision, done: "marked Hire" };
const HOLD: Step = { label: "Hold", stage: RecruitmentPipelineStage.on_hold, done: "put on hold" };
const BACK_TO_HR: Step = { label: "Back to HR Round", stage: RecruitmentPipelineStage.hr_round, done: "moved back to HR Round" };
const BACK_TO_MANAGER: Step = { label: "Back to Manager Round", stage: RecruitmentPipelineStage.manager_round, done: "moved back to Manager Round" };

/** "Move to stage" in the ⋯ menu: the paper-plan groups. */
const MENU_STEPS: ReadonlyArray<{ bucket: BatchBucket; step: Step }> = [
  { bucket: "hr_round", step: { ...BACK_TO_HR, label: "HR Round", done: "moved to HR Round" } },
  { bucket: "manager_round", step: { ...BACK_TO_MANAGER, label: "Manager Round", done: "moved to Manager Round" } },
  { bucket: "hire", step: HIRE },
  { bucket: "on_hold", step: HOLD },
];

/** What was just done, so it can be undone from the panel. */
type LastAction = { applicationId: string; text: string; undo: () => Promise<{ error?: string }> };

/**
 * Steps saved in this tab that the page may not show yet (it reloads in the
 * background). Going back to that person shows the new stage straight away.
 */
const recentMoves = new Map<string, { stage: string; bucket: BatchBucket; at: number }>();
const RECENT_MS = 60_000;

function withRecentMove(facts: CandidateFacts | null): CandidateFacts | null {
  if (!facts) return null;
  const move = recentMoves.get(facts.applicationId);
  if (!move) return facts;
  if ((facts.stage === move.stage && facts.bucket === move.bucket) || Date.now() - move.at > RECENT_MS) {
    recentMoves.delete(facts.applicationId);
    return facts;
  }
  const label = BATCH_BUCKETS.find((b) => b.id === move.bucket)?.label ?? facts.stageLabel;
  return { ...facts, stage: move.stage, bucket: move.bucket, stageLabel: label };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const menuItemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

function daysSince(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS));
}

/** While the Pipeline is still loading the full details, show what the card already knows. */
function basicFacts(application: PipelineDrawerApplication): CandidateFacts {
  const bucket = batchBucket(String(application.currentStage), application.status);
  const years = application.candidate.totalExperienceYears;
  return {
    applicationId: application.id,
    candidateId: application.candidate.id,
    name: application.candidate.fullName,
    email: application.candidate.email ?? null,
    phone: application.candidate.phone ?? null,
    location: application.candidate.location ?? null,
    education: null,
    experienceYears: years == null ? null : Number(years),
    experiences: [],
    currentCtc: null,
    expectedCtc: null,
    noticePeriod: null,
    resume: application.resume ? { id: application.resume.id, fileName: application.resume.fileName } : null,
    role: application.jobOpening.title,
    jobOpeningId: application.jobOpening.id,
    stage: String(application.currentStage),
    stageLabel: application.currentStageLabel ?? BATCH_BUCKETS.find((b) => b.id === bucket)?.label ?? String(application.currentStage),
    bucket,
    hrStars: null,
    hrScorecards: 0,
    managerStars: null,
    managerScorecards: 0,
    commentCount: 0,
  };
}

/**
 * The one candidate panel, used on Batches and on the Pipeline: the facts,
 * one-click steps (HR Round → Manager Round → Hire / Reject / Hold), comments,
 * resume and scorecards. After each step the next person opens, with Undo.
 */
export function CandidateReviewPanel({
  facts: factsProp,
  application,
  open,
  onClose,
  prevId,
  nextId,
  onNavigate,
  editable = true,
  batch,
  mode = "hr",
}: {
  /** From the batch table. The Pipeline passes null and the panel uses application.facts. */
  facts: CandidateFacts | null;
  application: PipelineDrawerApplication | null;
  open: boolean;
  onClose: () => void;
  prevId: string | null;
  nextId: string | null;
  onNavigate?: (applicationId: string) => void;
  /** False for a closed batch: the panel only shows. */
  editable?: boolean;
  /** Set on the batch page: adds Remove from batch. */
  batch?: { batchId: string; memberId: string };
  /** "manager": a shared batch's manager. Only the Manager Round steps, no offers or menu. */
  mode?: "hr" | "manager";
}) {
  const isManager = mode === "manager";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [closeKind, setCloseKind] = useState<"reject" | "withdraw" | null>(null);
  const [last, setLast] = useState<LastAction | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Set when a step saved but the page still shows the old stage. */
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const facts = withRecentMove(factsProp ?? application?.facts ?? (application ? basicFacts(application) : null));
  const details = usePanelDetails(facts?.applicationId ?? null, application);

  const applicationId = facts?.applicationId;
  useEffect(() => {
    setError(null);
    setConfirmRemove(false);
  }, [applicationId]);

  // Never stay locked if the page doesn't change (e.g. a slow reload).
  useEffect(() => {
    if (!savedKey) return;
    const t = setTimeout(() => setSavedKey(null), 20_000);
    return () => clearTimeout(t);
  }, [savedKey]);

  // J / K: next / previous person. Esc closes (handled by the sheet).
  useEffect(() => {
    if (!open || !onNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      if (closeKind || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "j" && nextId) onNavigate(nextId);
      else if (key === "k" && prevId) onNavigate(prevId);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, nextId, prevId, onNavigate, closeKind]);

  if (!open) return null;

  if (!facts) {
    return (
      <Sheet open={open} onClose={onClose} plain title="Candidate" description={batch ? "This person is no longer in the batch." : "This application could not be loaded."}>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </Sheet>
    );
  }

  const name = facts.name;
  const fromStage = facts.stage as RecruitmentPipelineStage;

  const currentId = facts.applicationId;
  const stateKey = `${currentId}:${facts.stage}:${facts.bucket}`;
  const saved = savedKey === stateKey;
  const isPending = busy || saved;

  /**
   * Saves, then moves on. Not a React transition: moving to the next person
   * must not wait for the whole page to reload first.
   */
  async function save(
    action: () => Promise<{ error?: string }>,
    after: () => void,
    options: { lock?: boolean } = { lock: true }
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      if (res.error) {
        setError(res.error);
        return;
      }
      if (options.lock) setSavedKey(stateKey);
      forgetPanelDetails(currentId);
      after();
    } finally {
      setBusy(false);
    }
  }

  /** Opens the next person straight away; the table catches up in the background. */
  function moveOn() {
    if (nextId && onNavigate) onNavigate(nextId);
    router.refresh();
  }

  /** Runs a step, then shows Undo and opens the next person. */
  function run(step: Step) {
    if (!facts) return;
    const id = facts.applicationId;
    void save(
      () => (step === HIRE ? markHireAction({ id }) : moveApplicationStageAction({}, { id, stage: step.stage })),
      () => {
        recentMoves.set(id, { stage: step.stage, bucket: batchBucket(step.stage, "active"), at: Date.now() });
        setLast({ applicationId: id, text: `${name} ${step.done}.`, undo: () => moveApplicationStageAction({}, { id, stage: fromStage }) });
        moveOn();
      }
    );
  }

  function reopen() {
    if (!facts) return;
    const id = facts.applicationId;
    void save(() => reopenApplicationAction({}, { id }), () => router.refresh());
  }

  function removeFromBatch() {
    if (!batch) return;
    void save(
      () => removeBatchMembersAction({ batchId: batch.batchId, memberIds: [batch.memberId] }),
      () => {
        setLast(null);
        if (nextId && onNavigate) onNavigate(nextId);
        else onClose();
        router.refresh();
      }
    );
  }

  function undoLast() {
    if (!last) return;
    const action = last;
    void save(
      action.undo,
      () => {
        recentMoves.delete(action.applicationId);
        forgetPanelDetails(action.applicationId);
        setLast(null);
        router.refresh();
      },
      { lock: false }
    );
  }

  const feedback: PipelineDrawerFeedback[] = details?.feedback ?? [];
  const resume = details?.resume ?? (facts.resume ? { ...facts.resume, mimeType: null } : null);
  const isPdf = resume ? (resume.mimeType ?? "").includes("pdf") || resume.fileName.toLowerCase().endsWith(".pdf") : false;
  const bucket = facts.bucket;
  const offers = details?.offers ?? [];
  const latestOffer = offers[0] ?? null;
  const acceptedOffer = offers.find((o) => o.status === OfferStatus.accepted) ?? null;
  const daysInStage = daysSince(details?.stageEnteredAt);
  // Our groups (Reject has its own button), plus any stage added to this job with Add stage.
  const moveSteps: Step[] = [
    ...MENU_STEPS.filter((m) => m.bucket !== facts.bucket).map((m) => m.step),
    ...(details?.stageOptions ?? [])
      .filter((o) => String(o.stage).startsWith("custom_") && o.stage !== facts.stage)
      .map((o) => ({ label: o.label, stage: o.stage as RecruitmentPipelineStage, done: `moved to ${o.label}` })),
  ];
  const isClosed = bucket === "rejected";
  // You rate the round the person is in now.
  const ratingRound = bucket === "manager_round" ? "manager" : bucket === "hr_round" && !isManager ? "hr" : null;
  const myRating = ratingRound
    ? ([...feedback].reverse().find((f) => f.mine && f.roundType === ratingRound) ?? null)
    : null;

  let steps: Step[] = [];
  let showReject = false;
  if (isManager) {
    if (bucket === "manager_round") {
      steps = [HIRE];
      showReject = true;
    } else if (bucket === "on_hold" || (bucket === "hire" && facts.stage === "decision" && offers.length === 0)) {
      steps = [BACK_TO_MANAGER];
    }
  } else if (bucket === "hr_round") {
    steps = [TO_MANAGER];
    showReject = true;
  } else if (bucket === "manager_round") {
    steps = [HIRE];
    showReject = true;
  } else if (bucket === "on_hold") {
    steps = [BACK_TO_HR, BACK_TO_MANAGER];
  } else if (bucket === "hire" && facts.stage !== "hired") {
    steps = [BACK_TO_MANAGER];
  }
  const showHold = bucket === "manager_round" || (bucket === "hr_round" && !isManager);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      plain
      title={name}
      description={facts.role}
      headerActions={
        onNavigate ? (
          <>
            <Button type="button" variant="ghost" size="sm" disabled={!prevId} onClick={() => prevId && onNavigate(prevId)} title="Previous (K)" aria-label="Previous person">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!nextId} onClick={() => nextId && onNavigate(nextId)} title="Next (J)" aria-label="Next person">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        ) : null
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
            <span className="font-medium">{facts.stageLabel}</span>
            {saved ? (
              <span className="text-muted-foreground"> · Saved{nextId ? ", opening next…" : ""}</span>
            ) : daysInStage !== null && !isClosed ? (
              <span className="text-muted-foreground"> · {daysInStage === 0 ? "since today" : `${daysInStage} day${daysInStage === 1 ? "" : "s"}`}</span>
            ) : null}
          </p>
          {editable ? (
            <div className="flex flex-wrap items-center gap-2">
              {isManager ? null : acceptedOffer ? (
                <Button asChild size="sm">
                  <Link href={`/admin/recruitment/conversions/${acceptedOffer.id}`}>Make employee</Link>
                </Button>
              ) : bucket === "hire" && facts.stage !== "hired" ? (
                latestOffer ? (
                  <Button asChild size="sm">
                    <Link href={`/admin/recruitment/offers/${latestOffer.id}`}>Open offer</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href={`/admin/recruitment/offers/new?applicationId=${facts.applicationId}`}>Make offer</Link>
                  </Button>
                )
              ) : null}
              {steps.map((s, i) => (
                <Button key={s.label} size="sm" variant={i === 0 && bucket !== "hire" ? "default" : "outline"} disabled={isPending} onClick={() => run(s)}>
                  {s.label}
                </Button>
              ))}
              {showReject ? (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => setCloseKind("reject")} className="text-danger hover:text-danger">
                  Reject
                </Button>
              ) : null}
              {showHold ? (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(HOLD)}>
                  Hold
                </Button>
              ) : null}
              {isClosed && !isManager ? (
                <Button size="sm" variant="outline" disabled={isPending} onClick={reopen}>
                  Reopen
                </Button>
              ) : null}
              {isManager ? null : (
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="sm" aria-label="More actions" disabled={isPending}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="z-[60] max-h-[70vh] min-w-[200px] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-elevated"
                  >
                    <DropdownMenu.Item className={menuItemClass} asChild>
                      <Link href={`/admin/recruitment/interviews/new?applicationId=${facts.applicationId}`}>Schedule interview</Link>
                    </DropdownMenu.Item>
                    {!isClosed ? (
                      <DropdownMenu.Item className={menuItemClass} onSelect={() => setCloseKind("withdraw")}>
                        Candidate withdrew…
                      </DropdownMenu.Item>
                    ) : null}
                    {!isClosed && moveSteps.length > 0 ? (
                      <>
                        <DropdownMenu.Separator className="my-1 h-px bg-border" />
                        <DropdownMenu.Label className="px-2 py-1 text-xs text-muted-foreground">Move to stage</DropdownMenu.Label>
                        {moveSteps.map((step) => (
                          <DropdownMenu.Item key={step.stage} className={menuItemClass} onSelect={() => run(step)}>
                            {step.label}
                          </DropdownMenu.Item>
                        ))}
                      </>
                    ) : null}
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item className={menuItemClass} asChild>
                      <Link href={`/admin/recruitment/applications/${facts.applicationId}`}>Full application</Link>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              )}
            </div>
          ) : null}
          {error ? <ErrorAlert message={error} /> : null}
          {details && (details.status === "rejected" || details.status === "withdrawn") ? (
            <CloseReasonSummary application={details} closedAt={details.stageEnteredAt} />
          ) : null}
        </div>

        {editable && ratingRound ? (
          details && details.viewerCanRate === false ? (
            <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              Your login isn&apos;t linked to an employee profile, so you can&apos;t give stars. Ask an admin to link it.
            </p>
          ) : details ? (
            <PanelRating
              key={`${facts.applicationId}:${ratingRound}`}
              applicationId={facts.applicationId}
              round={ratingRound}
              mine={myRating}
              onSaved={() => {
                forgetPanelDetails(facts.applicationId);
                router.refresh();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading rating…</p>
          )
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Experience</dt>
            <dd>
              {facts.experiences.length === 0
                ? facts.experienceYears != null
                  ? `${facts.experienceYears} yrs`
                  : "—"
                : facts.experiences.slice(0, 3).map((e) => (
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
              {formatCtc(facts.currentCtc) ?? "—"} / {formatCtc(facts.expectedCtc) ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Notice period</dt>
            <dd>{facts.noticePeriod ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">HR score</dt>
            <dd>{facts.hrStars != null ? <StarRatingDisplay value={facts.hrStars} size="xs" showNumber /> : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Manager score</dt>
            <dd>{facts.managerStars != null ? <StarRatingDisplay value={facts.managerStars} size="xs" showNumber /> : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Education</dt>
            <dd>{facts.education ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd>{facts.phone ? <a href={`tel:${facts.phone}`} className="hover:underline">{facts.phone}</a> : "—"}</dd>
          </div>
        </dl>

        {isManager ? (
          bucket === "hr_round" ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              With HR for now. You can rate and decide once they reach the Manager Round.
            </p>
          ) : null
        ) : (
          <Link href={`/admin/recruitment/candidates/${facts.candidateId}`} className="inline-block text-sm text-accent-blue hover:underline">
            Full profile
          </Link>
        )}

        {offers.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offer</h3>
            {offers.map((o) => (
              <Link
                key={o.id}
                href={`/admin/recruitment/offers/${o.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{o.offerNumber || "Draft offer"}</span>
                <OfferLine offer={o} />
              </Link>
            ))}
          </section>
        ) : null}

        <BatchComments candidateId={facts.candidateId} allowHrOnly={!isManager} />

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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">J / K: next / previous person.</p>
          {batch && editable ? (
            confirmRemove ? (
              <span className="flex items-center gap-2 text-sm">
                Remove {name} from this batch?
                <Button size="sm" variant="destructive" disabled={isPending} onClick={removeFromBatch}>
                  Remove
                </Button>
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirmRemove(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmRemove(true)}>
                Remove from batch
              </Button>
            )
          ) : null}
        </div>
      </div>

      <CloseApplicationDialog
        kind={closeKind ?? "reject"}
        applicationId={facts.applicationId}
        candidateName={name}
        jobTitle={facts.role}
        open={closeKind !== null}
        onOpenChange={(next) => {
          if (!next) setCloseKind(null);
        }}
        onDone={() => {
          const id = facts.applicationId;
          const kind = closeKind ?? "reject";
          recentMoves.set(id, { stage: facts.stage, bucket: "rejected", at: Date.now() });
          forgetPanelDetails(id);
          setLast({
            applicationId: id,
            text: `${name} ${kind === "reject" ? "rejected" : "marked as withdrawn"}.`,
            undo: () => reopenApplicationAction({}, { id, toStage: fromStage }),
          });
          setSavedKey(stateKey);
          moveOn();
        }}
      />
    </Sheet>
  );
}

/** "Sent", "In negotiation · asked 6 LPA · follow up 3 Oct" (red when overdue). */
function OfferLine({ offer }: { offer: OfferTrackingView & { negotiationNote?: string | null } }) {
  const overdue = isFollowUpOverdue(offer);
  const label = offerStageLabel(offer);
  const negotiating = label === "In negotiation";
  return (
    <span className="text-xs text-muted-foreground">
      {label}
      {negotiating && offer.negotiationNote ? ` · ${offer.negotiationNote}` : ""}
      {negotiating && offer.negotiationFollowUpAt ? (
        <span className={cn(overdue && "font-medium text-danger")}>
          {` · follow up ${new Date(offer.negotiationFollowUpAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${overdue ? " (overdue)" : ""}`}
        </span>
      ) : null}
    </span>
  );
}
