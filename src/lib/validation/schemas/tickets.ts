import { z } from "zod";

export const ticketCategorySchema = z.enum([
  "attendance",
  "leave",
  "payroll",
  "salary",
  "it_technical",
  "hr",
  "workplace",
  "facilities",
  "suggestion",
  "other",
]);

export const ticketTypeSchema = z.enum([
  "complaint",
  "service_request",
  "suggestion",
  "meeting_request",
  "anonymous_complaint",
  "other",
]);

export const ticketPrioritySchema = z.enum(["low", "medium", "high"]);

export const createTicketSchema = z.object({
  subject: z.string().min(3, "Summary must be at least 3 characters.").max(200, "Summary too long."),
  description: z
    .string()
    .min(10, "Details must be at least 10 characters.")
    .max(5000, "Details too long."),
  category: z.enum(ticketCategorySchema.options, { error: "Choose what your ticket is about." }),
  type: z.enum(ticketTypeSchema.options, { error: "Choose what you need." }),
  priority: z.enum(ticketPrioritySchema.options, { error: "Choose how urgent this is." }),
  isAnonymous: z.boolean().default(false),
});

export const ticketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1, "Reply cannot be empty.").max(5000, "Reply too long."),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;
