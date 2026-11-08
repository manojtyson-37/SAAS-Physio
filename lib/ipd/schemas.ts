import { z } from "zod";

export const WARD_TYPES = ["GENERAL", "SEMI_PRIVATE", "PRIVATE", "ICU", "NICU", "HDU", "OTHER"] as const;

const money = z.coerce.number().finite().min(0, "Rate cannot be negative").max(10_00_000, "Rate is too large");
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optDate = z.string().trim().optional().transform((v) => (v ? v : undefined)).pipe(z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date").optional());

export const wardSchema = z.object({
  name: z.string().trim().min(2, "Ward name is required").max(60),
  type: z.enum(WARD_TYPES).default("GENERAL"),
});
/** Edits send only the changed fields; no defaults (zod .partial() would re-apply them). */
export const updateWardSchema = z.object({
  name: z.string().trim().min(2, "Ward name is required").max(60).optional(),
  type: z.enum(WARD_TYPES).optional(),
  isActive: z.boolean().optional(),
});

export const bedSchema = z.object({
  wardId: z.string().min(1),
  label: z.string().trim().min(1, "Bed label is required").max(30),
  dailyRate: money.default(0),
});
export const updateBedSchema = z.object({
  label: z.string().trim().min(1, "Bed label is required").max(30).optional(),
  dailyRate: money.optional(),
  isActive: z.boolean().optional(),
});

export const admitSchema = z.object({
  patientId: z.string().min(1, "Choose a patient"),
  doctorId: z.string().min(1, "Choose a doctor"),
  bedId: z.string().min(1).optional(),
  reason: opt(500),
  diagnosis: opt(500),
  expectedDischargeAt: optDate,
  clientRef: z.string().trim().min(8, "clientRef too short").max(80).optional(),
});

export const updateAdmissionSchema = z.object({
  diagnosis: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  reason: z.string().trim().max(500).nullish(),
  expectedDischargeAt: z.string().trim().nullish().refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Enter a valid date"),
  doctorId: z.string().min(1).optional(),
}).refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update");

export const transferSchema = z.object({ toBedId: z.string().min(1, "Choose a bed") });

const int = (min: number, max: number, label: string) =>
  z.coerce.number().int(`${label} must be a whole number`).min(min, `${label} is too low`).max(max, `${label} is too high`);

const vitals = {
  systolic: int(30, 300, "Systolic"),
  diastolic: int(10, 200, "Diastolic"),
  pulse: int(10, 300, "Pulse"),
  respRate: int(2, 100, "Respiratory rate"),
  spo2: int(30, 100, "SpO2"),
  gcs: int(3, 15, "GCS"),
  intakeMl: int(0, 20_000, "Intake"),
  outputMl: int(0, 20_000, "Output"),
  tempC: z.coerce.number().min(30, "Temperature is too low").max(45, "Temperature is too high"),
};
// Blank form fields arrive as "" or null: treat as "not recorded".
const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const vitalFields = Object.fromEntries(Object.entries(vitals).map(([k, s]) => [k, z.preprocess(blank, s.optional())])) as unknown as {
  [K in keyof typeof vitals]: z.ZodType<number | undefined>;
};

export const chartSchema = z.object({
  kind: z.enum(["NURSING", "ICU"]).default("NURSING"),
  recordedAt: optDate,
  ...vitalFields,
  notes: opt(2000),
}).refine((v) => v.notes !== undefined || ["systolic", "diastolic", "pulse", "respRate", "spo2", "tempC", "gcs", "intakeMl", "outputMl"].some((k) => (v as Record<string, unknown>)[k] !== undefined), "Record at least one value or a note");

/** PATCH: null clears a value; absent leaves it unchanged. */
const clearable = (s: z.ZodType<number>) => z.union([z.null(), z.preprocess((v) => (v === "" ? null : v), z.union([z.null(), s]))]).optional();
export const updateChartSchema = z.object({
  kind: z.enum(["NURSING", "ICU"]).optional(),
  recordedAt: z.string().trim().optional().refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Enter a valid date"),
  systolic: clearable(vitals.systolic), diastolic: clearable(vitals.diastolic), pulse: clearable(vitals.pulse),
  respRate: clearable(vitals.respRate), spo2: clearable(vitals.spo2), gcs: clearable(vitals.gcs),
  intakeMl: clearable(vitals.intakeMl), outputMl: clearable(vitals.outputMl), tempC: clearable(vitals.tempC),
  notes: z.string().trim().max(2000).nullish(),
}).refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update");
