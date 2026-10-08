"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { OfferStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { moveApplicationStageAction } from "@/actions/recruitment-applications";
import { ApplicationAssessmentForm } from "@/components/recruitment/applications/application-assessment-form";
import { HiringDecisionForm } from "@/components/recruitment/applications/hiring-decision-form";
import type { HiringDecisionRecord } from "@/lib/recruitment/repositories/decision-repository";
import { canCreateOfferFromDecisionState } from "@/lib/recruitment/decision/eligibility";
import { CandidateTagsInput, type CandidateTagView } from "@/components/recruitment/applications/candidate-tags-input";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
} from "lucide-react";
import { CloseApplicationDialog } from "@/components/recruitment/applications/close-application-dialog";
import { CloseReasonSummary } from "@/components/recruitment/applications/close-reason-summary";
import {
  FeedbackScorecardDetails,
  ScorecardSummary,
  VerdictBadge,
} from "@/components/recruitment/interviews/scorecard-summary";
import { StarRatingDisplay } from "@/components/recruitment/interviews/star-rating";
import { INTERVIEW_STAGES } from "@/lib/recruitment/shared/pipeline-stage-groups";
import { movableStageOptions, nextStageAfter, stageLabel, type StageOption } from "@/lib/recruitment/shared/next-stage";
import { cn } from "@/lib/utils";
import {
  buildRecruitmentEntityHref,
  currentPathWithSearch,
  isSafeRecruitmentReturnTo,
} from "@/lib/recruitment/navigation/return-to";

/** Non-terminal, non-system-owned stages — reused by the bulk "Move Stage" action too. */
export const STAGE_OPTIONS: RecruitmentPipelineStage[] = [
  RecruitmentPipelineStage.resume_received,
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.offer,
  RecruitmentPipelineStage.decision,
];

export type PipelineDrawerFeedback = {
  id: string;
  authorName: string;
  interviewTitle: string;
  submittedAt: Date | string | null;
  ratingsJson: unknown;
  recommendation: string | null;
  consideredForPosition: boolean | null;
  overallRating: number | null;
  strengths: string | null;
  concerns: string | null;
  privateNotes: string | null;
};

export type PipelineDrawerApplication = {
  id: string;
  currentStage: RecruitmentPipelineStage | string;
  /** The job's own name for `currentStage`, when known. */
  currentStageLabel?: string | null;
  status: string;
  rejectedReason?: string | null;
  rejectionReasonCode?: string | null;
  withdrawnReason?: string | null;
  withdrawalReasonCode?: string | null;
  stageEnteredAt?: Date | string | null;
  source?: string | null;
  recruiterName?: string | null;
  /** The job's own stage order and names (falls back to the default order). */
  stageOptions?: StageOption[];
  resume?: { id: string; fileName: string; mimeType: string | null } | null;
  feedback?: PipelineDrawerFeedback[];
  priority?: string | null;
  createdAt: Date | string;
  candidate: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    totalExperienceYears?: number | string | null;
    currentCompany?: string | null;
    location?: string | null;
    noticePeriodDays?: number | null;
  };
  tags?: CandidateTagView[];
  jobOpening: {
    id: string;
    title: string;
  };
  interviews?: Array<{
    id: string;
    title: string;
    scheduledStart: Date | string;
    status: string;
  }>;
  offers?: Array<{
    id: string;
    offerNumber?: string | null;
    status: string;
    ctc?: number | string | null;
  }>;
  stageHistory?: Array<{
    id: string;
    toStage?: string | null;
    fromStage?: string | null;
    createdAt: Date | string;
    note?: string | null;
    actorEmail?: string | null;
  }>;
  assessment?: string | null;
  assessmentUpdatedAt?: Date | string | null;
  assessmentUpdatedByEmail?: string | null;
  currentDecision?: HiringDecisionRecord | null;
  requireDecisionForOffer?: boolean;
};

type Tab = "overview" | "resume" | "feedback" | "activity";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS));
}

function formatDay(value: Date | string): string {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
  );
}

const menuItemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold outline-none data-[highlighted]:bg-muted";

export function ApplicationPipelineDrawer({
  application,
  open,
  onClose,
  prevId,
  nextId,
  onNavigate,
}: {
  application: PipelineDrawerApplication | null;
  open: boolean;
  onClose: () => void;
  /** Neighbouring candidates in the same column, for ‹ › and J/K. */
  prevId?: string | null;
  nextId?: string | null;
  onNavigate?: (id: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [closeKind, setCloseKind] = useState<"reject" | "withdraw" | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const pipelineReturnTo = (() => {
    const path = currentPathWithSearch(pathname, searchParams.toString());
    return isSafeRecruitmentReturnTo(path) ? path : "/admin/recruitment/pipeline";
  })();

  // Each candidate opens on Overview.
  const applicationId = application?.id;
  useEffect(() => {
    setTab("overview");
    setError(null);
  }, [applicationId]);

  const stageOptions = useMemo(
    () => application?.stageOptions ?? movableStageOptions(null),
    [application?.stageOptions]
  );
  const isOpenApplication = application?.status === "active" || application?.status === "on_hold";
  const nextStage =
    application && isOpenApplication ? nextStageAfter(application.currentStage, stageOptions) : null;

  const moveStage = (stage: RecruitmentPipelineStage) => {
    if (!application) return;
    setError(null);
    startTransition(async () => {
      const res = await moveApplicationStageAction({}, { id: application.id, stage });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  // J/K: previous/next candidate · E: move to next stage · R: reject.
  useEffect(() => {
    if (!open || !application) return;
    const onKey = (e: KeyboardEvent) => {
      if (closeKind || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "j" && nextId && onNavigate) onNavigate(nextId);
      else if (key === "k" && prevId && onNavigate) onNavigate(prevId);
      else if (key === "e" && nextStage && !isPending) moveStage(nextStage.stage);
      else if (key === "r" && isOpenApplication) setCloseKind("reject");
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // moveStage is recreated each render; the deps below cover what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, application, closeKind, nextId, prevId, onNavigate, nextStage, isPending, isOpenApplication]);

  if (!open) return null;

  if (!application) {
    return (
      <Sheet open={open} onClose={onClose} title="Application" description="Not found or out of scope.">
        <p className="text-sm text-muted-foreground">This application could not be loaded.</p>
        <Button className="mt-4" variant="outline" onClick={onClose}>
          Close
        </Button>
      </Sheet>
    );
  }

  const acceptedOffer = application.offers?.find((o) => o.status === OfferStatus.accepted);
  const canCreateOffer = canCreateOfferFromDecisionState(
    application.requireDecisionForOffer ?? true,
    application.currentDecision?.outcome
  );
  const feedback = application.feedback ?? [];
  const daysInStage = daysSince(application.stageEnteredAt);
  const fullApplicationHref = buildRecruitmentEntityHref(`/admin/recruitment/applications/${application.id}`, {
    returnTo: pipelineReturnTo,
    jobOpeningId: application.jobOpening.id,
    currentStage: String(application.currentStage),
  });
  const workspaceHref = buildRecruitmentEntityHref(`/admin/recruitment/candidates/${application.candidate.id}`, {
    returnTo: pipelineReturnTo,
    applicationId: application.id,
    jobOpeningId: application.jobOpening.id,
    currentStage: String(application.currentStage),
  });
  const scheduleHref = `/admin/recruitment/interviews/new?applicationId=${application.id}`;
  const createOfferHref = `/admin/recruitment/offers/new?applicationId=${application.id}`;

  const headerActions =
    onNavigate && (prevId || nextId) ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!prevId}
          onClick={() => prevId && onNavigate(prevId)}
          aria-label="Previous candidate (K)"
          title="Previous candidate (K)"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!nextId}
          onClick={() => nextId && onNavigate(nextId)}
          aria-label="Next candidate (J)"
          title="Next candidate (J)"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </>
    ) : null;

  const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "resume", label: "Resume", disabled: !application.resume },
    { id: "feedback", label: feedback.length ? `Feedback (${feedback.length})` : "Feedback" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={application.candidate.fullName}
      description={application.jobOpening.title}
      headerActions={headerActions}
    >
      <div className="space-y-4">
        {/* Where are we? */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 font-bold text-primary">
            {stageLabel(application.currentStage, stageOptions)}
          </span>
          {daysInStage !== null ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {daysInStage === 0 ? "Today" : `${daysInStage} day${daysInStage === 1 ? "" : "s"} in stage`}
            </span>
          ) : null}
          {application.source ? <span>Source: {application.source.replace(/_/g, " ")}</span> : null}
          <span>Owner: {application.recruiterName ?? "Unassigned"}</span>
        </div>

        {/* One main action, reject beside it, the rest under ⋯ */}
        {isOpenApplication ? (
          <div className="flex items-center gap-2">
            {nextStage ? (
              <Button
                size="sm"
                className="flex-1 gap-1.5 text-xs font-semibold"
                disabled={isPending}
                onClick={() => moveStage(nextStage.stage)}
                title="Move to next stage (E)"
              >
                Move to {nextStage.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : acceptedOffer ? (
              <Button asChild size="sm" className="flex-1 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">
                <Link href={`/admin/recruitment/conversions/${acceptedOffer.id}`}>Convert to employee</Link>
              </Button>
            ) : (
              <span className="flex-1 text-xs text-muted-foreground">Last stage reached.</span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setCloseKind("reject")}
              className="text-xs font-semibold text-red-600 hover:bg-red-50/50 hover:text-red-700"
              title="Reject (R)"
            >
              Reject
            </Button>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <Button variant="outline" size="sm" aria-label="More actions" disabled={isPending}>
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
                    <Link href={scheduleHref}>
                      <CalendarClock className="h-3.5 w-3.5" /> Schedule interview
                    </Link>
                  </DropdownMenu.Item>
                  {canCreateOffer ? (
                    <DropdownMenu.Item className={menuItemClass} asChild>
                      <Link href={createOfferHref}>
                        <Briefcase className="h-3.5 w-3.5" /> Create offer
                      </Link>
                    </DropdownMenu.Item>
                  ) : null}
                  <DropdownMenu.Item
                    className={cn(menuItemClass, "text-amber-600 dark:text-amber-400")}
                    onSelect={() => setCloseKind("withdraw")}
                  >
                    Withdraw…
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Label className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Move to stage
                  </DropdownMenu.Label>
                  {stageOptions
                    .filter((o) => o.stage !== application.currentStage)
                    .map((o) => (
                      <DropdownMenu.Item key={o.stage} className={menuItemClass} onSelect={() => moveStage(o.stage)}>
                        {o.label}
                      </DropdownMenu.Item>
                    ))}
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item className={menuItemClass} asChild>
                    <Link href={fullApplicationHref}>
                      <ExternalLink className="h-3.5 w-3.5" /> Full application
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemClass} asChild>
                    <Link href={workspaceHref}>Candidate workspace</Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        ) : null}

        {error && <ErrorAlert message={error} />}
        <CloseReasonSummary application={application} closedAt={application.stageEnteredAt} />

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              disabled={t.disabled}
              onClick={() => setTab(t.id)}
              title={t.disabled ? "No resume uploaded" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <div className="space-y-5">
            {isOpenApplication ? (
              <NextStepCard
                application={application}
                feedback={feedback}
                canCreateOffer={canCreateOffer}
                scheduleHref={scheduleHref}
                createOfferHref={createOfferHref}
                onShowResume={() => setTab("resume")}
                onShowFeedback={() => setTab("feedback")}
              />
            ) : null}

            <ContactDetails application={application} workspaceHref={workspaceHref} />
            <CandidateTagsInput candidateId={application.candidate.id} tags={application.tags ?? []} />

            <ApplicationAssessmentForm
              applicationId={application.id}
              assessment={application.assessment}
              assessmentUpdatedAt={application.assessmentUpdatedAt}
              assessmentUpdatedByEmail={application.assessmentUpdatedByEmail}
              compact
            />

            <HiringDecisionForm
              applicationId={application.id}
              currentDecision={application.currentDecision ?? null}
              compact
            />

            {(application.offers?.length ?? 0) > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Offer</h3>
                <ul className="space-y-2">
                  {application.offers!.map((item) => (
                    <li key={item.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold">{item.offerNumber || "Draft offer"}</p>
                        <p className="text-[11px] capitalize text-muted-foreground">{item.status.replace(/_/g, " ")}</p>
                      </div>
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link href={`/admin/recruitment/offers/${item.id}`}>Open</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="text-[10px] text-muted-foreground">
              Shortcuts: <kbd className="font-semibold">J</kbd>/<kbd className="font-semibold">K</kbd> next/previous
              candidate · <kbd className="font-semibold">E</kbd> move to next stage · <kbd className="font-semibold">R</kbd>{" "}
              reject
            </p>
          </div>
        ) : null}

        {tab === "resume" && application.resume ? <ResumePane resume={application.resume} /> : null}

        {tab === "feedback" ? <FeedbackPane feedback={feedback} scheduleHref={scheduleHref} /> : null}

        {tab === "activity" ? <ActivityPane application={application} stageOptions={stageOptions} /> : null}
      </div>

      <CloseApplicationDialog
        kind={closeKind ?? "reject"}
        applicationId={application.id}
        candidateName={application.candidate.fullName}
        jobTitle={application.jobOpening.title}
        open={closeKind !== null}
        onOpenChange={(next) => {
          if (!next) setCloseKind(null);
        }}
        onDone={() => router.refresh()}
      />
    </Sheet>
  );
}

/** What to do now, based on the stage, with warnings for skipped steps. */
function NextStepCard({
  application,
  feedback,
  canCreateOffer,
  scheduleHref,
  createOfferHref,
  onShowResume,
  onShowFeedback,
}: {
  application: PipelineDrawerApplication;
  feedback: PipelineDrawerFeedback[];
  canCreateOffer: boolean;
  scheduleHref: string;
  createOfferHref: string;
  onShowResume: () => void;
  onShowFeedback: () => void;
}) {
  const stage = application.currentStage as RecruitmentPipelineStage;
  const interviews = application.interviews ?? [];
  const now = Date.now();
  const upcoming = interviews
    .filter((i) => i.status === "scheduled" && new Date(i.scheduledStart).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())[0];
  const heldInterviews = interviews.filter((i) => i.status === "completed").length;
  const warnings: string[] = [];
  if (application.currentDecision && feedback.length === 0) {
    warnings.push("A hiring decision is recorded, but no interviewer has submitted a scorecard.");
  }
  if ((stage === RecruitmentPipelineStage.decision || stage === RecruitmentPipelineStage.offer) && interviews.length === 0) {
    warnings.push("No interviews are on record for this candidate.");
  }

  let title: string;
  let body: React.ReactNode = null;
  let action: React.ReactNode = null;

  if (stage === RecruitmentPipelineStage.resume_received || stage === RecruitmentPipelineStage.screening) {
    title = "Review the resume, then move on or reject";
    action = application.resume ? (
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onShowResume}>
        <FileText className="h-3.5 w-3.5" /> View resume
      </Button>
    ) : (
      <span className="text-[11px] text-muted-foreground">No resume uploaded.</span>
    );
  } else if (INTERVIEW_STAGES.includes(stage) || stage === RecruitmentPipelineStage.assessment || stage === RecruitmentPipelineStage.reference_check) {
    if (upcoming) {
      title = "Interview coming up";
      body = (
        <p className="text-xs text-foreground">
          {upcoming.title} · {new Date(upcoming.scheduledStart).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </p>
      );
      action = (
        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
          <Link href={`/admin/recruitment/interviews/${upcoming.id}`}>Open interview</Link>
        </Button>
      );
    } else {
      title = "Schedule the interview for this round";
      action = (
        <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
          <Link href={scheduleHref}>
            <CalendarClock className="h-3.5 w-3.5" /> Schedule interview
          </Link>
        </Button>
      );
    }
    if (heldInterviews > 0) {
      body = (
        <>
          {body}
          <p className="text-[11px] text-muted-foreground">
            {feedback.length} scorecard{feedback.length === 1 ? "" : "s"} in from {heldInterviews} completed interview
            {heldInterviews === 1 ? "" : "s"}.
          </p>
        </>
      );
    }
  } else if (stage === RecruitmentPipelineStage.decision) {
    title = application.currentDecision ? "Decision recorded" : "Review feedback and record the decision";
    action = feedback.length ? (
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onShowFeedback}>
        See {feedback.length} scorecard{feedback.length === 1 ? "" : "s"}
      </Button>
    ) : null;
  } else if (stage === RecruitmentPipelineStage.offer) {
    const offer = application.offers?.[0];
    title = offer ? `Offer ${offer.status.replace(/_/g, " ")}` : "Prepare the offer";
    action = offer ? (
      <Button asChild size="sm" variant="outline" className="h-8 text-xs">
        <Link href={`/admin/recruitment/offers/${offer.id}`}>Open offer</Link>
      </Button>
    ) : canCreateOffer ? (
      <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
        <Link href={createOfferHref}>
          <Briefcase className="h-3.5 w-3.5" /> Create offer
        </Link>
      </Button>
    ) : (
      <span className="text-[11px] text-muted-foreground">Record a Hire decision first.</span>
    );
  } else {
    title = "Keep the candidate moving";
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next step</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {action}
      </div>
      {body}
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
        </p>
      ))}
    </section>
  );
}

/** Contact and snapshot facts, hiding anything blank. */
function ContactDetails({
  application,
  workspaceHref,
}: {
  application: PipelineDrawerApplication;
  workspaceHref: string;
}) {
  const c = application.candidate;
  const facts = [
    c.totalExperienceYears != null && c.totalExperienceYears !== "" ? `${c.totalExperienceYears} yrs exp` : null,
    c.currentCompany || null,
    c.noticePeriodDays != null ? `${c.noticePeriodDays}d notice` : null,
  ].filter(Boolean) as string[];
  const missing = [c.totalExperienceYears == null, !c.currentCompany, c.noticePeriodDays == null, !c.location, !c.phone].filter(Boolean).length;

  return (
    <section className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {c.email ? (
          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Mail className="h-3.5 w-3.5" /> {c.email}
          </a>
        ) : null}
        {c.phone ? (
          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Phone className="h-3.5 w-3.5" /> {c.phone}
          </a>
        ) : null}
        {c.location ? (
          <span className="inline-flex items-center gap-1 text-foreground">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {c.location}
          </span>
        ) : null}
      </div>
      {facts.length ? <p className="text-foreground">{facts.join(" · ")}</p> : null}
      {missing >= 3 ? (
        <Link href={workspaceHref} className="inline-block text-[11px] font-semibold text-primary hover:underline">
          + Add missing details
        </Link>
      ) : null}
    </section>
  );
}

function ResumePane({ resume }: { resume: NonNullable<PipelineDrawerApplication["resume"]> }) {
  const query = `id=${encodeURIComponent(resume.id)}`;
  const isPdf = resume.mimeType === "application/pdf" || resume.fileName.toLowerCase().endsWith(".pdf");
  const isImage = resume.mimeType?.startsWith("image/") ?? false;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-semibold text-foreground">{resume.fileName}</span>
        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
          <a href={`/api/recruitment/documents/download?${query}&name=${encodeURIComponent(resume.fileName)}`}>Download</a>
        </Button>
      </div>
      {isPdf ? (
        <iframe
          src={`/api/recruitment/documents/preview?${query}`}
          title={resume.fileName}
          className="h-[70vh] w-full rounded-lg border border-border bg-background"
        />
      ) : isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/recruitment/documents/preview?${query}`} alt={resume.fileName} className="w-full rounded-lg border border-border" />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          This file type can&apos;t be previewed here. Use Download to open it.
        </p>
      )}
    </div>
  );
}

function FeedbackPane({ feedback, scheduleHref }: { feedback: PipelineDrawerFeedback[]; scheduleHref: string }) {
  if (feedback.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No scorecards yet.{" "}
        <Link href={scheduleHref} className="font-semibold text-primary hover:underline">
          Schedule an interview
        </Link>{" "}
        to collect feedback.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ScorecardSummary feedback={feedback} />
      <ul className="space-y-3">
        {feedback.map((f) => (
          <li key={f.id} className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-foreground">{f.authorName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f.interviewTitle}
                  {f.submittedAt ? ` · ${formatDay(f.submittedAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StarRatingDisplay value={f.overallRating} showNumber />
                <VerdictBadge recommendation={f.recommendation} consideredForPosition={f.consideredForPosition} />
              </div>
            </div>
            <FeedbackScorecardDetails feedback={f} />
            {f.strengths ? <p className="whitespace-pre-wrap text-xs text-muted-foreground">{f.strengths}</p> : null}
            {f.concerns ? (
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                <span className="font-semibold">Concerns:</span> {f.concerns}
              </p>
            ) : null}
            {f.privateNotes ? (
              <p className="whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50/60 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-semibold">Comment to HR:</span> {f.privateNotes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityPane({
  application,
  stageOptions,
}: {
  application: PipelineDrawerApplication;
  stageOptions: StageOption[];
}) {
  const history = application.stageHistory ?? [];
  if (history.length === 0) return <p className="text-xs text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="space-y-3">
      {history.map((item) => (
        <li key={item.id} className="border-l-2 border-border pl-3">
          <p className="text-xs font-medium text-foreground">
            {item.fromStage ? `${stageLabel(item.fromStage, stageOptions)} → ` : ""}
            {item.toStage ? stageLabel(item.toStage, stageOptions) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(item.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            {item.actorEmail ? ` · ${item.actorEmail}` : ""}
          </p>
          {item.note ? <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{item.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}
