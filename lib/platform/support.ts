import { z } from "zod";

export const TICKET_CATEGORIES = ["QUESTION", "ISSUE", "BILLING", "FEATURE"] as const;
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CLINIC", "RESOLVED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const newTicketSchema = z.object({
  subject: z.string().trim().min(3, "Give the query a short subject").max(140),
  category: z.enum(TICKET_CATEGORIES).default("QUESTION"),
  urgent: z.boolean().default(false),
  body: z.string().trim().min(3, "Describe what you need").max(4000),
});
export const messageSchema = z.object({ body: z.string().trim().min(1, "Write a message").max(4000) });
export const platformReplySchema = z.object({
  body: z.string().trim().min(1, "Write a reply").max(4000),
  /** Defaults to WAITING_CLINIC (we answered, the clinic's turn). */
  status: z.enum(TICKET_STATUSES).optional(),
});
export const ticketPatchSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  urgent: z.boolean().optional(),
  assignToMe: z.boolean().optional(),
});

/** Hours since `from`, for "waiting for X hours" displays. */
export const ageHours = (from: Date, now = new Date()) => Math.max(0, Math.round((now.getTime() - from.getTime()) / 3_600_000));

/** A ticket still needs the platform team when it is not resolved and the clinic wrote last (or nobody answered yet). */
export const needsPlatform = (t: { status: string; lastBy: string }) => t.status !== "RESOLVED" && t.lastBy === "CLINIC";
