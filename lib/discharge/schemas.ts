import { z } from "zod";
import { isValidDayKey } from "@/lib/hospital/dates";

const text = (max: number) => z.string().trim().max(max).nullish();

/** All fields optional and without defaults: a PUT changes only what it sends. */
export const summarySchema = z.object({
  diagnosis: text(1000),
  courseInHospital: text(6000),
  proceduresDone: text(3000),
  investigationsSummary: text(6000),
  conditionAtDischarge: text(1000),
  medicationsOnDischarge: text(4000),
  adviceFollowUp: text(3000),
  followUpDate: z.string().trim().nullish().refine((v) => !v || isValidDayKey(v), "Follow-up must be a real date (YYYY-MM-DD)"),
  doctorId: z.string().min(1).optional(),
});
