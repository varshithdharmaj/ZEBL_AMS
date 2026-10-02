import { z } from "zod";
import { InterviewRoundType, InterviewStatus } from "@/generated/prisma/enums";
import { SCORECARD_CRITERIA, VERDICT_VALUES } from "@/lib/recruitment/interview/scorecard";

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
    .number({ error: `Give ${label} a star rating.` })
    .int()
    .min(1, `Give ${label} a star rating.`)
    .max(5, `${label} rating must be 1 to 5 stars.`);

// Every scorecard criterion is required; keys are criterion ids (see scorecard.ts).
const scorecardRatingsSchema = z.object(
  Object.fromEntries(
    SCORECARD_CRITERIA.map((c) => [c.id, criterionScoreSchema(c.label)])
  ) as Record<(typeof SCORECARD_CRITERIA)[number]["id"], ReturnType<typeof criterionScoreSchema>>,
  { error: "Rate the candidate on every scorecard criterion." }
);

export const submitFeedbackSchema = z.object({
  interviewId: z.string().trim().min(1, "Interview ID is required."),
  verdict: z.enum(VERDICT_VALUES, { error: "Choose whether the candidate can be considered." }),
  ratingsJson: scorecardRatingsSchema,
  remarks: z.string().trim().max(5000, "Remarks must be 5000 characters or fewer.").optional(),
  commentToHr: z.string().trim().max(5000, "Comment must be 5000 characters or fewer.").optional(),
});

export type SubmitFeedbackInput = z.input<typeof submitFeedbackSchema>;
