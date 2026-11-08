import { z } from "zod";

const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const count = (max: number) => z.coerce.number().int().min(1).max(max);
/** Blank or null clears the number; omitted stays undefined (so a template value can show through). */
const optCount = (max: number) => z.union([z.literal("").transform(() => null), z.null(), count(max)]).optional();
/** Same for text: blank clears, omitted stays undefined. */
const keepText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v === undefined ? undefined : v || null));
const dateStr = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Not a valid date");

export const templateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  category: z.string().trim().min(1).max(40).default("General"),
  description: optText(300),
  sets: optCount(50), reps: optCount(500), holdSeconds: optCount(600),
  instructions: optText(2000),
});
/** No .default() anywhere: omitted fields stay as they are. */
export const updateTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(300).nullish(),
  sets: optCount(50),
  reps: optCount(500),
  holdSeconds: optCount(600),
  instructions: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
});

export const itemInputSchema = z.object({
  templateId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  sets: optCount(50), reps: optCount(500), holdSeconds: optCount(600),
  frequency: keepText(60),
  instructions: keepText(2000),
}).refine((v) => v.templateId || v.name, { message: "Pick a template or give the exercise a name", path: ["name"] });

export const createPlanSchema = z.object({
  patientId: z.string().min(1, "Choose a patient"),
  title: z.string().trim().min(2, "Give the plan a title").max(120),
  startDate: dateStr.optional(),
  endDate: dateStr.nullish(),
  notes: optText(1000),
  items: z.array(itemInputSchema).max(40).default([]),
});

export const updatePlanSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(1000).nullish(),
  endDate: dateStr.nullish(),
  status: z.enum(["COMPLETED", "CANCELLED"]).optional(),
});

export const updateItemSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  sets: optCount(50),
  reps: optCount(500),
  holdSeconds: optCount(600),
  frequency: z.string().trim().max(60).nullish(),
  instructions: z.string().trim().max(2000).nullish(),
});

export const reorderSchema = z.object({ order: z.array(z.string().min(1)).min(1).max(100) });

const score = (max: number, msg: string) => z.coerce.number().int().min(0, msg).max(max, msg);
export const progressSchema = z.object({
  painScore: score(10, "Pain score must be between 0 and 10").nullish(),
  adherencePercent: score(100, "Adherence must be between 0 and 100").nullish(),
  notes: optText(500),
  recordedAt: dateStr.optional(),
}).refine((v) => v.painScore != null || v.adherencePercent != null || v.notes, { message: "Enter a pain score, adherence or a note", path: ["painScore"] });

export const updateProgressSchema = z.object({
  progressId: z.string().min(1),
  painScore: score(10, "Pain score must be between 0 and 10").nullish(),
  adherencePercent: score(100, "Adherence must be between 0 and 100").nullish(),
  notes: z.string().trim().max(500).nullish(),
});
