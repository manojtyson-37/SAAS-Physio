import { z } from "zod";
import { isValidDayKey } from "@/lib/hospital/dates";
import { FLAGS } from "./logic";

const num = z.coerce.number().finite();
const price = num.gt(0, "Price must be more than zero").max(9_999_999);
const gst = num.min(0).max(28);
const ref = num.min(-1_000_000_000).max(1_000_000_000);

export const LAB_CATEGORIES = ["Hematology", "Biochemistry", "Lipid profile", "Liver function", "Thyroid", "Inflammation", "Urine routine", "Microbiology", "Serology", "Other"] as const;

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

const rangeOk = (d: { refLow?: number | null; refHigh?: number | null }) =>
  d.refLow == null || d.refHigh == null || d.refLow <= d.refHigh;
const RANGE_MSG = { message: "Range low must not be above range high", path: ["refHigh"] };

export const labTestSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  code: optText(20),
  category: z.string().trim().min(2).max(40).default("Biochemistry"),
  sampleType: optText(40),
  unit: optText(20),
  refLow: ref.optional(),
  refHigh: ref.optional(),
  refText: optText(120),
  price,
  gstPercent: gst.default(0),
}).refine(rangeOk, RANGE_MSG);

/** Edits change only the fields sent (no .default(), so omitted fields are never reset). null clears an optional field. */
export const updateLabTestSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120).optional(),
  code: z.string().trim().max(20).nullish(),
  category: z.string().trim().min(2).max(40).optional(),
  sampleType: z.string().trim().max(40).nullish(),
  unit: z.string().trim().max(20).nullish(),
  refLow: ref.nullish(),
  refHigh: ref.nullish(),
  refText: z.string().trim().max(120).nullish(),
  price: price.optional(),
  gstPercent: gst.optional(),
  isActive: z.boolean().optional(),
}).refine(rangeOk, RANGE_MSG);

export const createLabOrderSchema = z.object({
  patientId: z.string().min(1, "Choose a patient"),
  testIds: z.array(z.string().min(1)).min(1, "Choose at least one test").max(60),
  visitId: z.string().min(1).optional(),
  clinicalNotes: optText(500),
  bill: z.boolean().optional(),
  clientRef: z.string().trim().min(8).max(64),
});

export const updateLabOrderSchema = z.object({ clinicalNotes: z.string().trim().max(500).nullable() });

export const resultsSchema = z.object({
  results: z.array(z.object({
    itemId: z.string().min(1),
    value: z.string().trim().max(200),
    /** Technician override; leave out to compute from the range. */
    flag: z.enum(FLAGS as [string, ...string[]]).nullish(),
    remarks: z.string().trim().max(300).nullish(),
  })).min(1, "No results to save").max(80),
});

export const cancelSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) });

export const listQuerySchema = z.object({
  status: z.enum(["ORDERED", "COLLECTED", "RESULTED", "CANCELLED"]).optional(),
  from: z.string().refine(isValidDayKey, "Dates must be YYYY-MM-DD").optional(),
  to: z.string().refine(isValidDayKey, "Dates must be YYYY-MM-DD").optional(),
});
