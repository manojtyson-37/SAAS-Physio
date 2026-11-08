import { prisma } from "@/lib/db";
import type { ModuleKey } from "@/lib/modules/registry";
import { buildPrefill } from "./prefill";

export const SUMMARY_SELECT = {
  id: true, admissionId: true, status: true, diagnosis: true, courseInHospital: true, proceduresDone: true, investigationsSummary: true,
  conditionAtDischarge: true, medicationsOnDischarge: true, adviceFollowUp: true, followUpDate: true, finalizedAt: true, updatedAt: true,
  doctor: { select: { id: true, name: true, title: true, specialty: true } },
} as const;

/** Prefill from the record of the stay. Lab and imaging are read only when those modules are on for the clinic. */
export async function loadPrefill(tenantId: string, a: { patientId: string; diagnosis: string | null; reason: string | null; admittedAt: Date; dischargedAt: Date | null }, modules: Set<ModuleKey>) {
  const window = { gte: a.admittedAt, lte: a.dischargedAt ?? new Date() };
  const [labs, imaging, rx] = await Promise.all([
    modules.has("lab")
      ? prisma.labOrderItem.findMany({
          where: { resultValue: { not: null }, order: { tenantId, patientId: a.patientId, deletedAt: null, createdAt: window } },
          orderBy: [{ order: { createdAt: "asc" } }, { sortOrder: "asc" }], take: 200,
          select: { testName: true, resultValue: true, unit: true, flag: true },
        })
      : Promise.resolve([]),
    modules.has("radiology")
      ? prisma.imagingOrder.findMany({
          where: { tenantId, patientId: a.patientId, deletedAt: null, status: "REPORTED", impression: { not: null }, createdAt: window },
          orderBy: { createdAt: "asc" }, take: 50, select: { studyName: true, impression: true },
        })
      : Promise.resolve([]),
    prisma.prescriptionItem.findMany({
      where: { prescription: { tenantId, patientId: a.patientId, createdAt: window } },
      orderBy: [{ prescription: { createdAt: "asc" } }, { sortOrder: "asc" }], take: 100,
      select: { genericName: true, brandName: true, strength: true, form: true, dose: true, frequency: true, durationDays: true, instructions: true },
    }),
  ]);
  return buildPrefill({
    admission: { diagnosis: a.diagnosis, reason: a.reason },
    labs: labs.map((l) => ({ testName: l.testName, resultValue: l.resultValue!, unit: l.unit, flag: l.flag })),
    imaging: imaging.map((i) => ({ studyName: i.studyName, impression: i.impression! })),
    rx,
  });
}

export const summaryView = <T extends { followUpDate: Date | null }>(s: T) => ({ ...s, followUpDate: s.followUpDate ? s.followUpDate.toISOString().slice(0, 10) : null });
