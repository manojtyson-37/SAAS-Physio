import { z } from "zod";
import { CONDITIONS, isValidTooth, normalizeSurfaces } from "./fdi";

const tooth = z.coerce.number().int().refine(isValidTooth, "Not a valid FDI tooth number");
const surfaces = z.string().trim().max(12).nullish().transform((v, ctx) => {
  const n = normalizeSurfaces(v);
  if (n === undefined) { ctx.addIssue({ code: "custom", message: "Surfaces can only use M, O, D, B, L, I" }); return z.NEVER; }
  return n;
});
const notes = z.string().trim().max(500).nullish().transform((v) => v || null);
const price = z.coerce.number().finite().gt(0, "Price must be more than zero").max(10_00_000);
const gst = z.coerce.number().finite().min(0).max(28);

export const toothRecordSchema = z.object({
  tooth,
  condition: z.enum(CONDITIONS),
  surfaces,
  notes,
});

export const createPlanSchema = z.object({
  patientId: z.string().min(1, "Choose a patient"),
  title: z.string().trim().min(2, "Give the plan a title").max(120),
  notes,
  items: z.array(z.object({
    tooth: tooth.nullish().transform((v) => v ?? null),
    procedure: z.string().trim().min(2, "Procedure is required").max(120),
    price, gstPercent: gst.default(0),
  })).max(60).default([]),
});

/** Update schemas have no .default(): omitted fields stay untouched. */
export const updatePlanSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(500).nullish(),
  status: z.enum(["PROPOSED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

export const addItemSchema = z.object({
  tooth: tooth.nullish().transform((v) => v ?? null),
  procedure: z.string().trim().min(2, "Procedure is required").max(120),
  price, gstPercent: gst.default(0),
});

export const updateItemSchema = z.object({
  tooth: tooth.nullish(),
  procedure: z.string().trim().min(2).max(120).optional(),
  price: price.optional(),
  gstPercent: gst.optional(),
  status: z.enum(["PLANNED", "DONE"]).optional(),
});
