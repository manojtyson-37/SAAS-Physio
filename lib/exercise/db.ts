import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/hospital/http";
import type { ExerciseStatus } from "./logic";

export const TX_OPTS = { timeout: 20_000, maxWait: 10_000 } as const;

/** Locks the plan row (tenant-checked) for the rest of the transaction. Every plan/item mutation takes this first. */
export async function lockPlan(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const rows = await tx.$queryRaw<{ id: string; status: ExerciseStatus; patientId: string }[]>`
    SELECT id, status::text AS status, "patientId" FROM "ExercisePlan" WHERE id = ${id} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
  if (rows.length === 0) throw new HttpError(404, "Exercise plan not found");
  return rows[0];
}

export async function requirePatient(tenantId: string, patientId: string) {
  const p = await prisma.patient.findFirst({ where: { id: patientId, tenantId, deletedAt: null }, select: { id: true, name: true, uhid: true } });
  if (!p) throw new HttpError(404, "Patient not found");
  return p;
}

export async function audit(tx: Prisma.TransactionClient, tenantId: string, actorId: string, action: "CREATE" | "UPDATE" | "DELETE", entity: string, entityId: string) {
  await tx.auditLog.create({ data: { tenantId, actorId, action, entity, entityId } });
}

/** Plan with items, progress and doctor name, in API shape. */
export async function planView(tenantId: string, id: string) {
  const plan = await prisma.exercisePlan.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      items: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      progress: { orderBy: [{ recordedAt: "asc" }, { id: "asc" }] },
      patient: { select: { id: true, name: true, uhid: true, phone: true } },
      doctor: { select: { name: true } },
    },
  });
  if (!plan) throw new HttpError(404, "Exercise plan not found");
  return {
    id: plan.id, patientId: plan.patientId, patient: plan.patient, doctor: plan.doctor?.name ?? null, title: plan.title, status: plan.status,
    startDate: plan.startDate, endDate: plan.endDate, notes: plan.notes, createdAt: plan.createdAt,
    items: plan.items.map((i) => ({ id: i.id, templateId: i.templateId, name: i.name, sets: i.sets, reps: i.reps, holdSeconds: i.holdSeconds, frequency: i.frequency, instructions: i.instructions })),
    progress: plan.progress.map((p) => ({ id: p.id, recordedAt: p.recordedAt, painScore: p.painScore, adherencePercent: p.adherencePercent, notes: p.notes })),
  };
}

export const templateView = (t: { id: string; name: string; category: string; description: string | null; sets: number | null; reps: number | null; holdSeconds: number | null; instructions: string | null; isActive: boolean }) => ({
  id: t.id, name: t.name, category: t.category, description: t.description, sets: t.sets, reps: t.reps, holdSeconds: t.holdSeconds, instructions: t.instructions, isActive: t.isActive,
});

