import { describe, expect, it } from "vitest";
import { submitFeedbackSchema } from "@/lib/validation/schemas/recruitment/interviews";
import {
  SCORECARD_CRITERIA,
  isPositiveVerdict,
  normalizeVerdict,
  readScorecardRatings,
  scorecardAverage,
  starLabel,
  starTone,
  verdictLabel,
} from "@/lib/recruitment/interview/scorecard";

const ratings = {
  process_knowledge: 4,
  skills: 3,
  communication: 5,
  smartness: 4,
  eagerness_to_learn: 4,
};
const valid = { interviewId: "int-1", verdict: "yes", ratingsJson: ratings };

describe("scorecard criteria", () => {
  it("rates the five agreed qualities in order", () => {
    expect(SCORECARD_CRITERIA.map((c) => c.label)).toEqual([
      "Knowledge",
      "Skills",
      "Communication",
      "Smartness",
      "Eagerness to learn",
    ]);
  });
});

describe("scorecard validation", () => {
  it("accepts stars + verdict; remarks and comment to HR are optional", () => {
    expect(submitFeedbackSchema.safeParse(valid).success).toBe(true);
    expect(
      submitFeedbackSchema.safeParse({ ...valid, remarks: "Sharp", commentToHr: "Expects 6 LPA" }).success
    ).toBe(true);
  });

  it("requires every star rating", () => {
    const { skills: _omit, ...partial } = ratings;
    expect(submitFeedbackSchema.safeParse({ ...valid, ratingsJson: partial }).success).toBe(false);
  });

  it("rejects ratings outside 1-5 stars or half stars", () => {
    for (const bad of [0, 6, 3.5]) {
      expect(
        submitFeedbackSchema.safeParse({ ...valid, ratingsJson: { ...ratings, smartness: bad } }).success
      ).toBe(false);
    }
  });

  it("requires one of the four verdicts", () => {
    const { verdict: _omit, ...rest } = valid;
    expect(submitFeedbackSchema.safeParse(rest).success).toBe(false);
    expect(submitFeedbackSchema.safeParse({ ...valid, verdict: "maybe" }).success).toBe(false);
    for (const v of ["strong_no", "no", "yes", "strong_yes"]) {
      expect(submitFeedbackSchema.safeParse({ ...valid, verdict: v }).success).toBe(true);
    }
  });
});

describe("star colours and words", () => {
  it("colours 1-2 red, 3 amber, 4 light green, 5 green", () => {
    expect([1, 2, 3, 4, 5].map(starTone)).toEqual(["red", "red", "amber", "lime", "green"]);
    expect(starTone(4.3)).toBe("lime");
  });
  it("labels each star count", () => {
    expect([1, 2, 3, 4, 5].map(starLabel)).toEqual(["Poor", "Below average", "Average", "Good", "Excellent"]);
  });
});

describe("verdicts", () => {
  it("maps old hire recommendations onto the new verdict", () => {
    expect(normalizeVerdict("strong_hire")).toBe("strong_yes");
    expect(normalizeVerdict("lean_hire")).toBe("yes");
    expect(normalizeVerdict("strong_no_hire")).toBe("strong_no");
    expect(verdictLabel("no_hire")).toBe("No");
    expect(normalizeVerdict(null)).toBeNull();
  });
  it("treats Yes and Strong Yes as 'can be considered'", () => {
    expect(isPositiveVerdict("yes")).toBe(true);
    expect(isPositiveVerdict("strong_yes")).toBe(true);
    expect(isPositiveVerdict("no")).toBe(false);
    expect(isPositiveVerdict("hire")).toBe(true);
  });
});

describe("scorecard helpers", () => {
  it("reads known criteria and ignores legacy keys", () => {
    expect(readScorecardRatings({ technical: 4, communication: 3, qualitative: "Good" })).toEqual({
      communication: 3,
    });
    expect(readScorecardRatings(null)).toEqual({});
  });

  it("averages rated criteria", () => {
    expect(scorecardAverage(ratings)).toBe(4);
    expect(scorecardAverage({})).toBeNull();
  });
});
