import { z } from "zod";
import { isValidDayKey } from "@/lib/hospital/dates";
import { MODALITIES } from "./logic";

const num = z.coerce.number().finite();
const price = num.gt(0, "Price must be more than zero").max(9_999_999);
const gst = num.min(0).max(28);
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const modality = z.enum(MODALITIES);

export const studyTypeSchema = z.object({
  modality,
  name: z.string().trim().min(2, "Name is required").max(120),
  bodyPart: optText(60),
  price,
  gstPercent: gst.default(0),
});

/** Edits change only the fields sent (no .default()). */
export const updateStudyTypeSchema = z.object({
  modality: modality.optional(),
  name: z.string().trim().min(2, "Name is required").max(120).optional(),
  bodyPart: z.string().trim().max(60).nullish(),
  price: price.optional(),
  gstPercent: gst.optional(),
  isActive: z.boolean().optional(),
});

export const createImagingOrderSchema = z.object({
  patientId: z.string().min(1, "Choose a patient"),
  studyTypeId: z.string().min(1, "Choose a study"),
  visitId: z.string().min(1).optional(),
  clinicalInfo: optText(500),
  bill: z.boolean().optional(),
  clientRef: z.string().trim().min(8).max(64),
});

export const updateImagingOrderSchema = z.object({ clinicalInfo: z.string().trim().max(500).nullable() });

export const scheduleSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true, message: "Enter a valid date and time" }).refine((s) => new Date(s).getFullYear() >= 2000 && new Date(s).getFullYear() <= 2100, "Enter a valid date and time"),
});

export const reportSchema = z.object({
  findings: z.string().trim().min(3, "Findings are required").max(8000),
  impression: z.string().trim().max(2000).nullish(),
});

export const cancelSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) });

export const listQuerySchema = z.object({
  status: z.enum(["ORDERED", "SCHEDULED", "PERFORMED", "REPORTED", "CANCELLED"]).optional(),
  modality: modality.optional(),
  from: z.string().refine(isValidDayKey, "Dates must be YYYY-MM-DD").optional(),
  to: z.string().refine(isValidDayKey, "Dates must be YYYY-MM-DD").optional(),
});
