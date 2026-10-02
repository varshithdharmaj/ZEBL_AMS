import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FeedbackForm } from "@/components/recruitment/interviews/feedback-form";
import {
  FeedbackScorecardDetails,
  ScorecardSummary,
  VerdictBadge,
} from "@/components/recruitment/interviews/scorecard-summary";
import { StarRatingDisplay, StarRatingInput } from "@/components/recruitment/interviews/star-rating";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/actions/recruitment-interviews", () => ({
  submitInterviewFeedbackAction: vi.fn(),
}));

const ratings = { process_knowledge: 4, skills: 3, communication: 5, smartness: 2, eagerness_to_learn: 4 };

describe("star rating", () => {
  it("shows the word and colour for the chosen stars", () => {
    const html = renderToStaticMarkup(<StarRatingInput label="Skills" value={5} onChange={() => {}} />);
    expect(html).toContain("Excellent");
    expect(html).toContain("fill-emerald-600");
    expect(html).toContain('aria-valuenow="5"');
  });

  it("shows 'Not rated' with empty stars", () => {
    const html = renderToStaticMarkup(<StarRatingInput label="Skills" value={undefined} onChange={() => {}} />);
    expect(html).toContain("Not rated");
    expect(html).not.toContain("fill-emerald-600");
  });

  it("colours low scores red", () => {
    expect(renderToStaticMarkup(<StarRatingDisplay value={2} />)).toContain("fill-red-500");
  });
});

describe("scorecard form", () => {
  it("renders five star rows, four verdict buttons and remarks on a blank form", () => {
    const html = renderToStaticMarkup(<FeedbackForm interviewId="int-1" applicationId="app-1" />);
    for (const label of ["Knowledge", "Skills", "Communication", "Smartness", "Eagerness to learn"]) {
      expect(html).toContain(label);
    }
    for (const v of ["Strong No", ">No<", ">Yes<", "Strong Yes"]) expect(html).toContain(v);
    expect(html.match(/>Not rated</g)).toHaveLength(5);
    expect(html).toContain("Remarks");
    expect(html).toContain("+ Add comment to HR");
    expect(html).toContain("0 of 5 rated");
  });

  it("prefills an older scorecard: maps the verdict and merges strengths/concerns", () => {
    const html = renderToStaticMarkup(
      <FeedbackForm
        interviewId="int-1"
        applicationId="app-1"
        initialValues={{
          recommendation: "strong_hire",
          strengths: "Sharp",
          concerns: "Slow typing",
          privateNotes: "Wants WFH",
          ratingsJson: { ...ratings, communication: 4.6 },
        }}
      />
    );
    expect(html).toContain("Ready to submit");
    expect(html).toMatch(/aria-checked="true"[^>]*>Strong Yes</);
    expect(html).toContain("Sharp\n\nSlow typing");
    expect(html).toContain("Comment to HR");
    expect(html).toContain("Update scorecard");
  });
});

describe("scorecard views", () => {
  it("summarises the panel's average stars and verdicts", () => {
    const html = renderToStaticMarkup(
      <ScorecardSummary
        feedback={[
          { ratingsJson: ratings, recommendation: "yes" },
          { ratingsJson: { ...ratings, communication: 3 }, recommendation: "strong_no" },
        ]}
      />
    );
    expect(html).toContain("Panel assessment · 2 interviewers");
    expect(html).toContain("1 × Yes");
    expect(html).toContain("1 × Strong No");
    expect(html).toContain(">4<"); // communication average (5 + 3) / 2
  });

  it("shows nothing extra for old feedback without stars or a verdict", () => {
    const legacy = { ratingsJson: { technical: 4 }, recommendation: null, consideredForPosition: null };
    expect(renderToStaticMarkup(<ScorecardSummary feedback={[legacy]} />)).toBe("");
    expect(renderToStaticMarkup(<FeedbackScorecardDetails feedback={legacy} />)).toBe("");
  });

  it("labels verdicts, including old-style recommendations", () => {
    expect(renderToStaticMarkup(<VerdictBadge recommendation="no_hire" />)).toContain(">No<");
    expect(renderToStaticMarkup(<VerdictBadge consideredForPosition />)).toContain(">Yes<");
  });
});
