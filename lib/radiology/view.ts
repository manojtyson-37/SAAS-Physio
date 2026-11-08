import { prisma } from "@/lib/db";

/** Invoices have no foreign key from the order, so look them up (same clinic only). */
export async function invoiceMap(tenantId: string, ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (list.length === 0) return new Map<string, { id: string; number: string; status: string }>();
  const rows = await prisma.invoice.findMany({ where: { tenantId, id: { in: list } }, select: { id: true, number: true, status: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

type Dec = { toString(): string };
export const typeView = (t: { id: string; modality: string; name: string; bodyPart: string | null; price: Dec; gstPercent: Dec; isActive: boolean }) => ({
  id: t.id, modality: t.modality, name: t.name, bodyPart: t.bodyPart, price: Number(t.price), gstPercent: Number(t.gstPercent), isActive: t.isActive,
});

/** Full order for the detail and report screens. Null when it is not this clinic's. */
export async function loadImagingOrder(tenantId: string, id: string) {
  const o = await prisma.imagingOrder.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      patient: { select: { id: true, name: true, uhid: true, gender: true, dob: true, phone: true } },
      orderedBy: { select: { name: true } },
    },
  });
  if (!o) return null;
  const ids = [o.performedById, o.reportedById].filter((x): x is string => !!x);
  const [tenant, inv, logs, people] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, phone: true } }),
    invoiceMap(tenantId, [o.invoiceId]),
    prisma.auditLog.findMany({
      where: { tenantId, entity: "ImagingOrder", entityId: id, action: { in: ["CANCEL", "AMEND"] } },
      orderBy: { timestamp: "asc" }, select: { action: true, diff: true, timestamp: true, actor: { select: { name: true } } },
    }),
    ids.length ? prisma.user.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true, title: true } }) : Promise.resolve([]),
  ]);
  const who = new Map(people.map((p) => [p.id, [p.title, p.name].filter(Boolean).join(" ")]));
  const cancel = logs.filter((l) => l.action === "CANCEL").pop();
  return {
    id: o.id, orderNo: o.orderNo, status: o.status, studyName: o.studyName, modality: o.modality, bodyPart: o.bodyPart,
    price: Number(o.price), gstPercent: Number(o.gstPercent), clinicalInfo: o.clinicalInfo, visitId: o.visitId,
    createdAt: o.createdAt, scheduledAt: o.scheduledAt, performedAt: o.performedAt, reportedAt: o.reportedAt,
    findings: o.findings, impression: o.impression, orderedBy: o.orderedBy?.name ?? null,
    performedBy: o.performedById ? who.get(o.performedById) ?? null : null, reportedBy: o.reportedById ? who.get(o.reportedById) ?? null : null,
    patient: { ...o.patient, dob: o.patient.dob ? o.patient.dob.toISOString().slice(0, 10) : null },
    clinic: { name: tenant?.name ?? "", address: tenant?.address ?? null, phone: tenant?.phone ?? null },
    invoice: o.invoiceId ? inv.get(o.invoiceId) ?? null : null,
    cancelReason: cancel ? ((cancel.diff as { reason?: string } | null)?.reason ?? null) : null,
    amendments: logs.filter((l) => l.action === "AMEND").map((l) => ({ at: l.timestamp, by: l.actor?.name ?? null })),
  };
}
