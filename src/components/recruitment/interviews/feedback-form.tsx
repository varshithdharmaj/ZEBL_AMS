"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitInterviewFeedbackAction } from "@/actions/recruitment-interviews";
import { Button } from "@/components/ui/button";
import {
  NEGATIVE_RECOMMENDATIONS,
  POSITIVE_RECOMMENDATIONS,
  SCORECARD_CRITERIA,
  SCORECARD_SCALE,
  readScorecardRatings,
  scorecardAverage,
  scorecardScaleLabel,
  type ScorecardCriterionId,
  type ScorecardRatings,
} from "@/lib/recruitment/interview/scorecard";

export interface FeedbackFormInitialValues {
  overallRating: number | null;
  recommendation: string | null;
  consideredForPosition: boolean | null;
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

const labelClass =
  "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";
const textareaClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function FeedbackForm({
  interviewId,
  applicationId,
  initialValues,
  onSuccess,
}: FeedbackFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Feedback fields
  // Rounded because legacy/demo scorecards may hold fractional scores; the scale is whole numbers.
  const [criteria, setCriteria] = React.useState<Partial<ScorecardRatings>>(() =>
    Object.fromEntries(
      Object.entries(readScorecardRatings(initialValues?.ratingsJson)).map(([id, v]) => [
        id,
        Math.min(5, Math.max(1, Math.round(v))),
      ])
    )
  );
  const [consideredForPosition, setConsideredForPosition] = React.useState<boolean | null>(
    initialValues?.consideredForPosition ?? null
  );
  const [overallRating, setOverallRating] = React.useState<number>(
    initialValues?.overallRating ? Math.round(initialValues.overallRating) : 3
  );
  const [recommendation, setRecommendation] = React.useState<string>(
    initialValues?.recommendation ?? "hire"
  );
  const [strengths, setStrengths] = React.useState(initialValues?.strengths ?? "");
  const [concerns, setConcerns] = React.useState(initialValues?.concerns ?? "");
  const [privateNotes, setPrivateNotes] = React.useState(initialValues?.privateNotes ?? "");

  const criteriaAverage = scorecardAverage(criteria);
  const setCriterion = (id: ScorecardCriterionId, value: number) =>
    setCriteria((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const unrated = SCORECARD_CRITERIA.filter((c) => criteria[c.id] === undefined);
    if (unrated.length > 0) {
      setError(`Please rate the candidate on: ${unrated.map((c) => c.label).join(", ")}.`);
      return;
    }
    if (consideredForPosition === null) {
      setError("Please select whether the candidate can be considered for the position.");
      return;
    }
    if (
      consideredForPosition &&
      (NEGATIVE_RECOMMENDATIONS as readonly string[]).includes(recommendation)
    ) {
      setError('A "No Hire" recommendation can\'t be marked as considered for the position.');
      return;
    }
    if (
      !consideredForPosition &&
      (POSITIVE_RECOMMENDATIONS as readonly string[]).includes(recommendation)
    ) {
      setError('A "Hire" recommendation must be marked as considered for the position.');
      return;
    }
    if (!strengths.trim()) {
      setError("Please describe the candidate's strengths.");
      return;
    }

    const payload = {
      interviewId,
      applicationId,
      overallRating,
      recommendation,
      consideredForPosition,
      ratingsJson: criteria,
      strengths,
      concerns,
      privateNotes,
    };

    startTransition(async () => {
      const res = await submitInterviewFeedbackAction({}, payload);
      if (res.error) {
        setError(res.error);
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <fieldset className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <legend className={labelClass}>Candidate Assessment</legend>
          <span className="text-[10px] font-semibold text-muted-foreground">
            1 = Poor · 3 = Average · 5 = Excellent
          </span>
        </div>
        <div className="rounded-lg border border-border divide-y divide-border/60 bg-background">
          {SCORECARD_CRITERIA.map((c) => {
            const value = criteria[c.id];
            return (
              <div
                key={c.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{c.description}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    role="radiogroup"
                    aria-label={`${c.label} rating`}
                    className="flex items-center gap-1"
                  >
                    {SCORECARD_SCALE.map((s) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={value === s.value}
                        key={s.value}
                        title={s.label}
                        onClick={() => setCriterion(c.id, s.value)}
                        className={`h-8 w-8 rounded-lg border font-bold text-xs transition-all ${
                          value === s.value
                            ? "bg-primary border-primary text-white shadow-subtle"
                            : "border-border hover:bg-muted/15 text-foreground"
                        }`}
                      >
                        {s.value}
                      </button>
                    ))}
                  </div>
                  <span className="w-24 text-[11px] font-semibold text-muted-foreground">
                    {value ? scorecardScaleLabel(value) : "Not rated"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div>
        <span className={labelClass}>Can be considered for the position?</span>
        <div role="radiogroup" className="flex items-center gap-2">
          {[
            { value: true, label: "Yes", active: "bg-emerald-600 border-emerald-600 text-white" },
            { value: false, label: "No", active: "bg-red-600 border-red-600 text-white" },
          ].map((opt) => (
            <button
              type="button"
              role="radio"
              aria-checked={consideredForPosition === opt.value}
              key={opt.label}
              onClick={() => setConsideredForPosition(opt.value)}
              className={`h-9 w-20 rounded-lg border font-bold text-sm transition-all ${
                consideredForPosition === opt.value
                  ? `${opt.active} shadow-subtle`
                  : "border-border hover:bg-muted/15 text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Overall Rating (1 - 5)</label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => setOverallRating(num)}
                className={`h-9 w-9 rounded-lg border font-bold text-sm transition-all ${
                  overallRating === num
                    ? "bg-primary border-primary text-white shadow-subtle"
                    : "border-border hover:bg-muted/15 text-foreground"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
          {criteriaAverage !== null ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Assessment average: <span className="font-bold">{criteriaAverage}</span>/5
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass}>Recommendation</label>
          <select
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
          >
            <option value="strong_hire">Strong Hire</option>
            <option value="hire">Hire</option>
            <option value="lean_hire">Lean Hire</option>
            <option value="no_hire">No Hire</option>
            <option value="strong_no_hire">Strong No Hire</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Strengths</label>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="What did the candidate do well? Mention technical skills, communication, etc..."
            rows={3}
            className={textareaClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Concerns / Weaknesses</label>
          <textarea
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            placeholder="Any areas of concern, gaps in knowledge, or red flags..."
            rows={3}
            className={textareaClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Private Notes (Optional)</label>
          <textarea
            value={privateNotes}
            onChange={(e) => setPrivateNotes(e.target.value)}
            placeholder="Notes only visible to HR and Recruiters..."
            rows={2}
            className={textareaClass}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="submit"
          loading={isPending}
          className="font-semibold text-xs h-9 rounded-lg shadow-subtle w-full sm:w-auto"
        >
          {isPending
            ? "Submitting…"
            : initialValues
              ? "Update Feedback Scorecard"
              : "Submit Feedback Scorecard"}
        </Button>
      </div>
    </form>
  );
}
