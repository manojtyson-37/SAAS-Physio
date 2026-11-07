import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** ABHA number: 14 digits, optionally written 12-3456-7890-1234. */
const abhaId = z
  .string()
  .trim()
  .refine((v) => /^\d{14}$/.test(v.replace(/-/g, "")), "ABHA number must be 14 digits")
  .transform((v) => v.replace(/-/g, ""));

export const registerPatientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(20),
  gender: optionalText(20),
  dob: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now(), "Date of birth cannot be in the future")
    .optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  allergies: optionalText(500),
  abhaId: abhaId.optional(),
  address: optionalText(300),
  reason: optionalText(300),
  referralDoctor: optionalText(120),
  notes: optionalText(1000),
  leadSource: z.enum(["DIRECT", "REFERRAL", "GOOGLE", "FACEBOOK", "WALK_IN", "WHATSAPP", "INSTAGRAM"]).optional(),
});

export const createVisitSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  type: z.enum(["OPD", "IPD", "EMERGENCY"]).default("OPD"),
  chiefComplaint: optionalText(500),
});

export const updateVisitSchema = z.object({
  status: z.enum(["WAITING", "IN_CONSULT", "COMPLETED", "CANCELLED"]).optional(),
  chiefComplaint: optionalText(500),
  diagnosis: optionalText(1000),
  advice: optionalText(2000),
  followUpDate: z.coerce.date().optional(),
});

const range = (min: number, max: number) => z.number().min(min).max(max).optional();

export const vitalsSchema = z
  .object({
    systolic: range(40, 300),
    diastolic: range(20, 200),
    pulse: range(20, 300),
    respRate: range(4, 80),
    spo2: range(30, 100),
    tempC: range(30, 45),
    weightKg: range(0.3, 500),
    heightCm: range(20, 260),
    notes: optionalText(500),
  })
  .refine(
    (v) => ["systolic", "diastolic", "pulse", "respRate", "spo2", "tempC", "weightKg", "heightCm"].some((k) => (v as Record<string, unknown>)[k] !== undefined),
    "Record at least one measurement",
  )
  .refine((v) => v.systolic === undefined || v.diastolic === undefined || v.diastolic < v.systolic, {
    message: "Diastolic must be lower than systolic",
    path: ["diastolic"],
  });

export const prescriptionItemSchema = z.object({
  /** NMC requires generic (non-proprietary) names; brand is optional. */
  genericName: z.string().trim().min(1, "Generic name is required").max(120),
  brandName: optionalText(120),
  form: optionalText(40),
  strength: optionalText(40),
  dose: optionalText(60),
  frequency: z.string().trim().min(1, "Frequency is required").max(40),
  durationDays: z.number().int().min(1).max(365).optional(),
  route: optionalText(40),
  instructions: optionalText(200),
});

export const prescriptionSchema = z.object({
  items: z.array(prescriptionItemSchema).min(1, "Add at least one medicine").max(40),
  notes: optionalText(1000),
});

export type VitalsInput = z.infer<typeof vitalsSchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
