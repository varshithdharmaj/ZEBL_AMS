import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FeedbackForm } from "@/components/recruitment/interviews/feedback-form";
import {
  FeedbackScorecardDetails,
  ScorecardSummary,
} from "@/components/recruitment/interviews/scorecard-summary";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/actions/recruitment-interviews", () => ({
  submitInterviewFeedbackAction: vi.fn(),
}));

const ratings = { communication: 4, process_knowledge: 3, smartness: 5, eagerness_to_learn: 4 };

describe("Interview scorecard UI", () => {
  it("renders every criterion and the Y/N question on a blank form", () => {
    const html = renderToStaticMarkup(<FeedbackForm interviewId="int-1" applicationId="app-1" />);
    for (const label of [
      "Communication",
      "Knowledge on the Process",
      "Smartness",
      "Eagerness to Learn",
      "Can be considered for the position?",
    ]) {
      expect(html).toContain(label);
    }
    expect(html.match(/Not rated/g)).toHaveLength(4);
    expect(html).toContain("Submit Feedback Scorecard");
  });

  it("prefills an existing scorecard, rounding legacy fractional scores", () => {
    const html = renderToStaticMarkup(
      <FeedbackForm
        interviewId="int-1"
        applicationId="app-1"
        initialValues={{
          overallRating: 4,
          recommendation: "hire",
          consideredForPosition: true,
          strengths: "Sharp",
          concerns: null,
          privateNotes: null,
          ratingsJson: { ...ratings, communication: 3.7 },
        }}
      />
    );
    expect(html).not.toContain("Not rated");
    expect(html).toContain("Excellent"); // smartness 5
    expect(html).toContain("Assessment average: <span class=\"font-bold\">4</span>/5");
    expect(html).toContain("Update Feedback Scorecard");
    expect(html).toMatch(/aria-checked="true"[^>]*>Yes</);
  });

  it("summarises the panel's scores and Y/N tally", () => {
    const html = renderToStaticMarkup(
      <ScorecardSummary
        feedback={[
          { ratingsJson: ratings, consideredForPosition: true },
          { ratingsJson: { ...ratings, communication: 2 }, consideredForPosition: false },
        ]}
      />
    );
    expect(html).toContain("Panel Assessment");
    expect(html).toContain("1 Yes");
    expect(html).toContain("1 No");
    expect(html).toContain("3/5"); // communication avg of 4 and 2
  });

  it("shows nothing extra for legacy feedback without scorecard data", () => {
    const legacy = { ratingsJson: { technical: 4 }, consideredForPosition: null };
    expect(renderToStaticMarkup(<ScorecardSummary feedback={[legacy]} />)).toBe("");
    expect(renderToStaticMarkup(<FeedbackScorecardDetails feedback={legacy} />)).toBe("");
  });

  it("shows an interviewer's scores and verdict", () => {
    const html = renderToStaticMarkup(
      <FeedbackScorecardDetails feedback={{ ratingsJson: ratings, consideredForPosition: false }} />
    );
    expect(html).toContain("Considered: No");
    expect(html).toContain("Eagerness to Learn");
    expect(html).toContain("Assessment average: 4/5");
  });
});
