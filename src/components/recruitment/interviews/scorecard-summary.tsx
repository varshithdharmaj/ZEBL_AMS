import { cn } from "@/lib/utils";
import {
  SCORECARD_CRITERIA,
  VERDICTS,
  normalizeVerdict,
  readScorecardRatings,
  scorecardAverage,
  type Verdict,
} from "@/lib/recruitment/interview/scorecard";
import { StarRatingDisplay } from "./star-rating";

type ScorecardFeedback = {
  ratingsJson: unknown;
  recommendation?: string | null;
  consideredForPosition?: boolean | null;
};

const VERDICT_BADGE: Record<Verdict, string> = {
  strong_no: "bg-red-600 text-white border-red-600",
  no: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
  yes: "bg-lime-50 text-lime-800 border-lime-300 dark:bg-lime-500/10 dark:text-lime-300 dark:border-lime-500/30",
  strong_yes: "bg-emerald-600 text-white border-emerald-600",
};

/** Verdict chip; falls back to the old Yes/No flag for scorecards without a verdict. */
export function VerdictBadge({
  recommendation,
  consideredForPosition,
}: {
  recommendation?: string | null;
  consideredForPosition?: boolean | null;
}) {
  const verdict =
    normalizeVerdict(recommendation) ??
    (consideredForPosition == null ? null : consideredForPosition ? "yes" : "no");
  if (!verdict) return null;
  const label = VERDICTS.find((v) => v.value === verdict)?.label;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold", VERDICT_BADGE[verdict])}>
      {label}
    </span>
  );
}

/** Panel-level roll-up: average stars per criterion and the verdict tally. */
export function ScorecardSummary({ feedback }: { feedback: readonly ScorecardFeedback[] }) {
  const perFeedback = feedback.map((f) => readScorecardRatings(f.ratingsJson));
  const criteria = SCORECARD_CRITERIA.map((c) => {
    const values = perFeedback.map((r) => r[c.id]).filter((v): v is number => typeof v === "number");
    return {
      ...c,
      average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null,
    };
  });
  const tally = new Map<Verdict, number>();
  for (const f of feedback) {
    const v =
      normalizeVerdict(f.recommendation) ??
      (f.consideredForPosition == null ? null : f.consideredForPosition ? "yes" : "no");
    if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
  }

  if (criteria.every((c) => c.average === null) && tally.size === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
          Panel assessment · {feedback.length} {feedback.length === 1 ? "interviewer" : "interviewers"}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {VERDICTS.filter((v) => tally.get(v.value)).map((v) => (
            <span key={v.value} className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", VERDICT_BADGE[v.value])}>
              {tally.get(v.value)} × {v.label}
            </span>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {criteria.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 text-xs">
            <dt className="font-semibold text-foreground">{c.label}</dt>
            <dd>
              <StarRatingDisplay value={c.average} showNumber />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One interviewer's stars, shown inside their feedback card. */
export function FeedbackScorecardDetails({ feedback }: { feedback: ScorecardFeedback }) {
  const ratings = readScorecardRatings(feedback.ratingsJson);
  if (scorecardAverage(ratings) === null) return null;

  return (
    <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      {SCORECARD_CRITERIA.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 text-xs">
          <dt className="text-muted-foreground">{c.label}</dt>
          <dd>
            <StarRatingDisplay value={ratings[c.id]} size="xs" />
          </dd>
        </div>
      ))}
    </dl>
  );
}
