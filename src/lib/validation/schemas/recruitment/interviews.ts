import { z } from "zod";
import { InterviewRoundType, InterviewStatus } from "@/generated/prisma/enums";
import {
  NEGATIVE_RECOMMENDATIONS,
  POSITIVE_RECOMMENDATIONS,
  SCORECARD_CRITERIA,
} from "@/lib/recruitment/interview/scorecard";

export const createInterviewSchema = z.object({
  applicationId: z.string().trim().min(1, "Application ID is required."),
  roundType: z.nativeEnum(InterviewRoundType),
  status: z.nativeEnum(InterviewStatus).optional().default(InterviewStatus.scheduled),
  title: z.string().trim().min(1, "Title is required."),
  scheduledStart: z.string().trim().min(1, "Scheduled start time is required."),
  scheduledEnd: z.string().trim().min(1, "Scheduled end time is required."),
  timezone: z.string().trim().optional().default("UTC"),
  location: z.string().trim().optional(),
  meetingUrl: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  panelistEmployeeIds: z.array(z.number().int().positive()).optional().default([]),
});

export const updateInterviewSchema = createInterviewSchema.partial().extend({
  id: z.string().trim().min(1, "Interview ID is required."),
});

export const interviewIdSchema = z.object({
  id: z.string().trim().min(1, "Interview ID is required."),
});

const criterionScoreSchema = (label: string) =>
  z
    .number({ error: `Rate the candidate on ${label}.` })
    .int()
    .min(1, `${label} rating must be between 1 and 5.`)
    .max(5, `${label} rating must be between 1 and 5.`);

// Every scorecard criterion is required; keys are criterion ids (see scorecard.ts).
const scorecardRatingsSchema = z.object(
  Object.fromEntries(
    SCORECARD_CRITERIA.map((c) => [c.id, criterionScoreSchema(c.label)])
  ) as Record<(typeof SCORECARD_CRITERIA)[number]["id"], ReturnType<typeof criterionScoreSchema>>,
  { error: "Rate the candidate on every scorecard criterion." }
);

export const submitFeedbackSchema = z
  .object({
    interviewId: z.string().trim().min(1, "Interview ID is required."),
    overallRating: z.number().min(1).max(5, "Rating must be between 1 and 5."),
    recommendation: z.enum(["strong_hire", "hire", "lean_hire", "no_hire", "strong_no_hire"]),
    consideredForPosition: z.boolean({
      error: "Select whether the candidate can be considered for the position.",
    }),
    strengths: z.string().trim().min(1, "Strengths are required."),
    concerns: z.string().trim().optional(),
    privateNotes: z.string().trim().optional(),
    ratingsJson: scorecardRatingsSchema,
  })
  .superRefine((data, ctx) => {
    const rec = data.recommendation;
    if (data.consideredForPosition && (NEGATIVE_RECOMMENDATIONS as readonly string[]).includes(rec)) {
      ctx.addIssue({
        code: "custom",
        path: ["consideredForPosition"],
        message: "A \"No Hire\" recommendation can't be marked as considered for the position.",
      });
    }
    if (!data.consideredForPosition && (POSITIVE_RECOMMENDATIONS as readonly string[]).includes(rec)) {
      ctx.addIssue({
        code: "custom",
        path: ["consideredForPosition"],
        message: "A \"Hire\" recommendation must be marked as considered for the position.",
      });
    }
  });
