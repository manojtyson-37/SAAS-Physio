import type { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/hospital/http";
import { prisma } from "@/lib/db";
import type { PlanStatus } from "./plan";
import { planTotals } from "./plan";

export const TX_OPTS = { timeout: 20_000, maxWait: 10_000 } as const;

/** Locks the plan row (tenant-checked) for the rest of the transaction; every plan/item mutation takes this lock first. */
export async function lockPlan(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const rows = await tx.$queryRaw<{ id: string; status: PlanStatus; patientId: string }[]>`
    SELECT id, status::text AS status, "patientId" FROM "TreatmentPlan" WHERE id = ${id} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
  if (rows.length === 0) throw new HttpError(404, "Treatment plan not found");
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

type ItemRow = { id: string; tooth: number | null; procedure: string; price: unknown; gstPercent: unknown; status: "PLANNED" | "DONE" | "CANCELLED"; doneAt: Date | null; invoiceId: string | null; sortOrder: number };

/** Plan + items in API shape. Cancelled items are returned (greyed out in UI) but excluded from totals. */
export async function planView(tenantId: string, id: string) {
  const plan = await prisma.treatmentPlan.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }, patient: { select: { id: true, name: true, uhid: true, phone: true } } },
  });
  if (!plan) throw new HttpError(404, "Treatment plan not found");
  const invIds = [...new Set(plan.items.map((i) => i.invoiceId).filter((x): x is string => !!x))];
  const invoices = invIds.length ? await prisma.invoice.findMany({ where: { id: { in: invIds }, tenantId }, select: { id: true, number: true, status: true } }) : [];
  const invMap = new Map(invoices.map((i) => [i.id, i]));
  return shape(plan, plan.items, invMap);
}

function shape(plan: { id: string; patientId: string; title: string; status: string; notes: string | null; createdAt: Date; patient?: { id: string; name: string; uhid: string | null; phone: string } }, items: ItemRow[], invMap: Map<string, { id: string; number: string; status: string }>) {
  const totals = planTotals(items.map((i) => ({ price: Number(i.price), gstPercent: Number(i.gstPercent), status: i.status })));
  const billableCount = items.filter((i) => i.status === "DONE" && (!i.invoiceId || invMap.get(i.invoiceId)?.status === "CANCELLED")).length;
  return {
    id: plan.id, patientId: plan.patientId, patient: plan.patient ?? null, title: plan.title, status: plan.status, notes: plan.notes, createdAt: plan.createdAt,
    items: items.map((i) => ({
      id: i.id, tooth: i.tooth, procedure: i.procedure, price: Number(i.price), gstPercent: Number(i.gstPercent), status: i.status, doneAt: i.doneAt,
      invoice: i.invoiceId ? invMap.get(i.invoiceId) ?? null : null,
    })),
    totals, billableCount,
  };
}
