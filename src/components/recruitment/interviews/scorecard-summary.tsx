import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  SCORECARD_CRITERIA,
  readScorecardRatings,
  scorecardAverage,
  scorecardScaleLabel,
} from "@/lib/recruitment/interview/scorecard";

type ScorecardFeedback = {
  ratingsJson: unknown;
  consideredForPosition: boolean | null;
};

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(100, (value / 5) * 100)}%` }}
      />
    </div>
  );
}

export function ConsideredBadge({ value }: { value: boolean | null }) {
  if (value === null) return null;
  return value ? (
    <Badge
      variant="outline"
      className="gap-1 font-bold text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
    >
      <CheckCircle2 className="h-3.5 w-3.5" /> Considered: Yes
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="gap-1 font-bold text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
    >
      <XCircle className="h-3.5 w-3.5" /> Considered: No
    </Badge>
  );
}

/** Panel-level roll-up: average per criterion and the Y/N verdict tally. */
export function ScorecardSummary({ feedback }: { feedback: readonly ScorecardFeedback[] }) {
  const perFeedback = feedback.map((f) => readScorecardRatings(f.ratingsJson));
  const criteriaAverages = SCORECARD_CRITERIA.map((c) => {
    const values = perFeedback
      .map((r) => r[c.id])
      .filter((v): v is number => typeof v === "number");
    return {
      ...c,
      average: values.length
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null,
    };
  });
  const yes = feedback.filter((f) => f.consideredForPosition === true).length;
  const no = feedback.filter((f) => f.consideredForPosition === false).length;

  if (criteriaAverages.every((c) => c.average === null) && yes + no === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Panel Assessment
        </h4>
        {yes + no > 0 ? (
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-emerald-700 dark:text-emerald-300">{yes} Yes</span>
            <span className="text-red-700 dark:text-red-300">{no} No</span>
            <span className="text-muted-foreground">for the position</span>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {criteriaAverages.map((c) => (
          <div key={c.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">{c.label}</span>
              <span className="font-bold text-muted-foreground">
                {c.average !== null ? `${c.average}/5` : "—"}
              </span>
            </div>
            <ScoreBar value={c.average ?? 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One interviewer's criterion scores and verdict, shown inside their feedback card. */
export function FeedbackScorecardDetails({ feedback }: { feedback: ScorecardFeedback }) {
  const ratings = readScorecardRatings(feedback.ratingsJson);
  const average = scorecardAverage(ratings);
  if (average === null && feedback.consideredForPosition === null) return null;

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ConsideredBadge value={feedback.consideredForPosition} />
        {average !== null ? (
          <span className="text-[11px] font-semibold text-muted-foreground">
            Assessment average: {average}/5
          </span>
        ) : null}
      </div>
      {average !== null ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SCORECARD_CRITERIA.map((c) => {
            const value = ratings[c.id];
            return (
              <div key={c.id} className="rounded-lg border border-border/60 px-2.5 py-1.5">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                  {c.label}
                </dt>
                <dd className="text-xs font-bold text-foreground">
                  {value !== undefined ? (
                    <>
                      {Math.round(value * 10) / 10}/5{" "}
                      <span className="font-medium text-muted-foreground">
                        {scorecardScaleLabel(value)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </div>
  );
}
