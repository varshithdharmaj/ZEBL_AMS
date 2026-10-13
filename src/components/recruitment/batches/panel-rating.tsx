"use client";

import { useEffect, useRef, useState } from "react";
import { StarRatingInput } from "@/components/recruitment/interviews/star-rating";
import {
  SCORECARD_CRITERIA,
  VERDICTS,
  readScorecardRatings,
  scorecardAverage,
  type ScorecardCriterionId,
  type Verdict,
} from "@/lib/recruitment/interview/scorecard";
import type { PipelineDrawerFeedback } from "@/components/recruitment/applications/application-pipeline-drawer";
import { cn } from "@/lib/utils";

type Round = "hr" | "manager";
type Status = "idle" | "saving" | "saved" | "error";

const ROUND_LABEL: Record<Round, string> = { hr: "HR Round", manager: "Manager Round" };

function isVerdict(value: unknown): value is Verdict {
  return VERDICTS.some((v) => v.value === value);
}

/**
 * Your stars for this round, right in the candidate panel. Once all five
 * stars and the answer are picked it saves by itself; later changes save too.
 */
export function PanelRating({
  applicationId,
  round,
  mine,
  onSaved,
}: {
  applicationId: string;
  round: Round;
  /** Your earlier scorecard for this round, if any. */
  mine: PipelineDrawerFeedback | null;
  onSaved: () => void;
}) {
  const [ratings, setRatings] = useState<Partial<Record<ScorecardCriterionId, number>>>(() =>
    mine ? readScorecardRatings(mine.ratingsJson) : {}
  );
  const [verdict, setVerdict] = useState<Verdict | null>(() => (mine && isVerdict(mine.recommendation) ? mine.recommendation : null));
  const [status, setStatus] = useState<Status>(mine ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const changed = useRef(false);
  const saving = useRef(false);
  const again = useRef(false);

  const complete = SCORECARD_CRITERIA.every((c) => ratings[c.id] !== undefined) && verdict !== null;
  const average = complete ? scorecardAverage(ratings) : null;

  async function save() {
    if (saving.current) {
      again.current = true;
      return;
    }
    saving.current = true;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/recruitment/applications/${encodeURIComponent(applicationId)}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, verdict, ratingsJson: ratings }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Couldn't save the rating. Please try again.");
        return;
      }
      setStatus("saved");
      onSaved();
    } catch {
      setStatus("error");
      setError("No connection. Please try again.");
    } finally {
      saving.current = false;
      if (again.current) {
        again.current = false;
        void save();
      }
    }
  }

  // Save a moment after the last change, once everything is filled in.
  useEffect(() => {
    if (!changed.current || !complete) return;
    const t = setTimeout(() => void save(), 500);
    return () => clearTimeout(t);
    // save reads the latest ratings and verdict when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratings, verdict, complete]);

  function rate(id: ScorecardCriterionId, value: number | undefined) {
    changed.current = true;
    setRatings((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  function choose(value: Verdict) {
    changed.current = true;
    setVerdict(value);
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your rating · {ROUND_LABEL[round]}
        </h3>
        <span className="text-xs text-muted-foreground" role="status">
          {average !== null ? `Average ${average} ★` : null}
          {status === "saving" ? " · Saving…" : status === "saved" ? " · Saved" : null}
        </span>
      </div>

      <div className="space-y-1.5">
        {SCORECARD_CRITERIA.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <span className="text-sm" title={c.description}>
              {c.label}
            </span>
            <StarRatingInput value={ratings[c.id]} onChange={(v) => rate(c.id, v)} label={c.label} />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm">Can they be considered?</p>
        <div role="radiogroup" aria-label="Can they be considered?" className="grid grid-cols-4 gap-1.5">
          {VERDICTS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="radio"
              aria-checked={verdict === v.value}
              onClick={() => choose(v.value)}
              className={cn(
                "h-8 rounded-md border text-xs font-medium transition-colors",
                verdict === v.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:bg-muted"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : !complete ? (
        <p className="text-xs text-muted-foreground">Rate all five and pick an answer. It saves by itself.</p>
      ) : null}
    </section>
  );
}
