import { prisma } from "@/lib/db";
import { istDateKey, istDayRange } from "@/lib/hospital/dates";
import { ICU_TYPES } from "./rules";

/** Headline IPD numbers for the dashboard. Tenant-scoped; call only when the ipd module is on. */
export async function ipdStats(tenantId: string) {
  const today = istDayRange(istDateKey());
  const [totalBeds, admitted, occupied, icuOccupied, dischargedToday] = await Promise.all([
    prisma.bed.count({ where: { tenantId, isActive: true, ward: { isActive: true } } }),
    prisma.admission.count({ where: { tenantId, status: "ADMITTED", deletedAt: null } }),
    prisma.admission.count({ where: { tenantId, status: "ADMITTED", deletedAt: null, bedId: { not: null } } }),
    prisma.admission.count({ where: { tenantId, status: "ADMITTED", deletedAt: null, bed: { ward: { type: { in: [...ICU_TYPES] } } } } }),
    prisma.admission.count({ where: { tenantId, status: "DISCHARGED", deletedAt: null, dischargedAt: { gte: today.start, lt: today.end } } }),
  ]);
  return { totalBeds, occupied, admitted, icuOccupied, dischargedToday };
}
