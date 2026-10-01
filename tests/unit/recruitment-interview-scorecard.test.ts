import { describe, expect, it } from "vitest";
import { submitFeedbackSchema } from "@/lib/validation/schemas/recruitment/interviews";
import {
  readScorecardRatings,
  scorecardAverage,
} from "@/lib/recruitment/interview/scorecard";

const valid = {
  interviewId: "int-1",
  overallRating: 4,
  recommendation: "hire",
  consideredForPosition: true,
  strengths: "Clear communicator.",
  ratingsJson: {
    communication: 4,
    process_knowledge: 3,
    smartness: 4,
    eagerness_to_learn: 5,
  },
};

describe("interview scorecard validation", () => {
  it("accepts a complete scorecard", () => {
    expect(submitFeedbackSchema.safeParse(valid).success).toBe(true);
  });

  it("requires every criterion", () => {
    const { eagerness_to_learn: _omit, ...partial } = valid.ratingsJson;
    const res = submitFeedbackSchema.safeParse({ ...valid, ratingsJson: partial });
    expect(res.success).toBe(false);
  });

  it("rejects scores outside 1-5 or fractional", () => {
    for (const bad of [0, 6, 3.5]) {
      const res = submitFeedbackSchema.safeParse({
        ...valid,
        ratingsJson: { ...valid.ratingsJson, smartness: bad },
      });
      expect(res.success).toBe(false);
    }
  });

  it("requires the considered-for-position verdict", () => {
    const { consideredForPosition: _omit, ...rest } = valid;
    expect(submitFeedbackSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a Yes verdict with a No Hire recommendation", () => {
    const res = submitFeedbackSchema.safeParse({ ...valid, recommendation: "no_hire" });
    expect(res.success).toBe(false);
  });

  it("rejects a No verdict with a Hire recommendation", () => {
    const res = submitFeedbackSchema.safeParse({ ...valid, consideredForPosition: false });
    expect(res.success).toBe(false);
  });

  it("allows either verdict with Lean Hire", () => {
    for (const consideredForPosition of [true, false]) {
      const res = submitFeedbackSchema.safeParse({
        ...valid,
        recommendation: "lean_hire",
        consideredForPosition,
      });
      expect(res.success).toBe(true);
    }
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
    expect(scorecardAverage(valid.ratingsJson)).toBe(4);
    expect(scorecardAverage({})).toBeNull();
  });
});
