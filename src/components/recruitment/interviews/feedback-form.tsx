"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitInterviewFeedbackAction } from "@/actions/recruitment-interviews";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SCORECARD_CRITERIA,
  VERDICTS,
  normalizeVerdict,
  readScorecardRatings,
  type ScorecardCriterionId,
  type ScorecardRatings,
  type Verdict,
} from "@/lib/recruitment/interview/scorecard";
import { StarRatingInput } from "./star-rating";

export interface FeedbackFormInitialValues {
  recommendation: string | null;
  strengths: string | null;
  concerns: string | null;
  privateNotes: string | null;
  ratingsJson: unknown;
}

interface FeedbackFormProps {
  interviewId: string;
  applicationId: string;
  /** The current user's previously submitted scorecard, when editing. */
  initialValues?: FeedbackFormInitialValues | null;
  onSuccess?: () => void;
}

type Draft = {
  ratings: Partial<ScorecardRatings>;
  verdict: Verdict | null;
  remarks: string;
  commentToHr: string;
};

const VERDICT_STYLE: Record<Verdict, string> = {
  strong_no: "border-red-600 bg-red-600 text-white",
  no: "border-red-400 bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
  yes: "border-lime-500 bg-lime-100 text-lime-900 dark:bg-lime-500/20 dark:text-lime-200",
  strong_yes: "border-emerald-600 bg-emerald-600 text-white",
};

const draftKey = (interviewId: string) => `scorecard-draft:${interviewId}`;

function initialDraft(initialValues: FeedbackFormInitialValues | null | undefined): Draft {
  return {
    // Rounded because older scorecards may hold fractional scores; the stars are whole numbers.
    ratings: Object.fromEntries(
      Object.entries(readScorecardRatings(initialValues?.ratingsJson)).map(([id, v]) => [
        id,
        Math.min(5, Math.max(1, Math.round(v))),
      ])
    ),
    verdict: normalizeVerdict(initialValues?.recommendation),
    // Older scorecards had separate strengths/concerns; fold them into remarks.
    remarks: [initialValues?.strengths, initialValues?.concerns].filter(Boolean).join("\n\n"),
    commentToHr: initialValues?.privateNotes ?? "",
  };
}

export function FeedbackForm({ interviewId, applicationId, initialValues, onSuccess }: FeedbackFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft>(() => initialDraft(initialValues));
  const [showHrComment, setShowHrComment] = React.useState(Boolean(initialValues?.privateNotes));
  const [restored, setRestored] = React.useState(false);

  // Restore an unsent draft for this interview (new scorecards only).
  React.useEffect(() => {
    if (initialValues) return;
    try {
      const raw = window.localStorage.getItem(draftKey(interviewId));
      if (!raw) return;
      const saved = JSON.parse(raw) as Draft;
      setDraft(saved);
      if (saved.commentToHr) setShowHrComment(true);
      setRestored(true);
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
  }, [initialValues, interviewId]);

  // Keep the draft as the interviewer works, so a closed tab loses nothing.
  React.useEffect(() => {
    if (initialValues) return;
    try {
      window.localStorage.setItem(draftKey(interviewId), JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, initialValues, interviewId]);

  const setRating = (id: ScorecardCriterionId, value: number | undefined) =>
    setDraft((d) => {
      const ratings = { ...d.ratings };
      if (value === undefined) delete ratings[id];
      else ratings[id] = value;
      return { ...d, ratings };
    });

  const unrated = SCORECARD_CRITERIA.filter((c) => draft.ratings[c.id] === undefined);
  const ready = unrated.length === 0 && draft.verdict !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (unrated.length > 0) {
      setError(`Add stars for ${unrated.map((c) => c.label).join(", ")}.`);
      return;
    }
    if (!draft.verdict) {
      setError("Choose whether the candidate can be considered.");
      return;
    }

    startTransition(async () => {
      const res = await submitInterviewFeedbackAction(
        {},
        {
          interviewId,
          applicationId,
          verdict: draft.verdict,
          ratingsJson: draft.ratings,
          remarks: draft.remarks,
          commentToHr: showHrComment ? draft.commentToHr : "",
        }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      try {
        window.localStorage.removeItem(draftKey(interviewId));
      } catch {
        /* ignore */
      }
      if (onSuccess) onSuccess();
      else router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {restored ? (
        <p className="text-[11px] font-medium text-muted-foreground">Restored your unsent draft.</p>
      ) : null}

      <div className="divide-y divide-border/60 rounded-xl border border-border bg-background">
        {SCORECARD_CRITERIA.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">{c.label}</div>
              <div className="text-[11px] leading-snug text-muted-foreground">{c.description}</div>
            </div>
            <StarRatingInput
              label={c.label}
              value={draft.ratings[c.id]}
              onChange={(v) => setRating(c.id, v)}
              disabled={isPending}
            />
          </div>
        ))}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Can be considered for the position?</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VERDICTS.map((v) => {
            const selected = draft.verdict === v.value;
            return (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={isPending}
                onClick={() => setDraft((d) => ({ ...d, verdict: v.value }))}
                className={cn(
                  "h-10 rounded-lg border text-sm font-bold transition-colors",
                  selected ? VERDICT_STYLE[v.value] : "border-border bg-background text-foreground hover:bg-muted/40"
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={`remarks-${interviewId}`} className="text-sm font-semibold text-foreground">
          Remarks <span className="font-normal text-muted-foreground">(seen by the hiring team)</span>
        </label>
        <textarea
          id={`remarks-${interviewId}`}
          value={draft.remarks}
          onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
          placeholder="What stood out — strengths, gaps, anything the next interviewer should probe…"
          rows={2}
          maxLength={5000}
          disabled={isPending}
          className="field-sizing-content min-h-[2.75rem] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {showHrComment ? (
        <div className="space-y-1.5">
          <label htmlFor={`hr-comment-${interviewId}`} className="text-sm font-semibold text-foreground">
            Comment to HR <span className="font-normal text-muted-foreground">(only HR sees this)</span>
          </label>
          <textarea
            id={`hr-comment-${interviewId}`}
            value={draft.commentToHr}
            onChange={(e) => setDraft((d) => ({ ...d, commentToHr: e.target.value }))}
            placeholder="e.g. salary expectations, notice period concerns, anything sensitive"
            rows={2}
            maxLength={5000}
            disabled={isPending}
            className="field-sizing-content min-h-[2.75rem] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowHrComment(true)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          + Add comment to HR (only HR sees this)
        </button>
      )}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-1 py-3 backdrop-blur">
        <span className="text-[11px] text-muted-foreground">
          {ready ? "Ready to submit" : `${SCORECARD_CRITERIA.length - unrated.length} of ${SCORECARD_CRITERIA.length} rated${draft.verdict ? "" : " · verdict needed"}`}
        </span>
        <Button type="submit" loading={isPending} className="h-9 rounded-lg text-xs font-semibold shadow-subtle">
          {isPending ? "Submitting…" : initialValues ? "Update scorecard" : "Submit scorecard"}
        </Button>
      </div>
    </form>
  );
}
