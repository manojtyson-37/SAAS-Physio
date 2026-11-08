import { prisma } from "@/lib/db";
import { istDateKey } from "@/lib/hospital/dates";
import { orderTotals, rangeText } from "./logic";

type Dec = { toString(): string } | null;
const n = (d: Dec) => (d == null ? null : Number(d));

export type InvoiceRef = { id: string; number: string; status: string };

/** Invoices have no foreign key from the order, so look them up (same clinic only) in one query. */
export async function invoiceMap(tenantId: string, ids: (string | null)[]): Promise<Map<string, InvoiceRef>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (list.length === 0) return new Map();
  const rows = await prisma.invoice.findMany({ where: { tenantId, id: { in: list } }, select: { id: true, number: true, status: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

type ItemRow = {
  id: string; testId: string | null; testName: string; unit: string | null; refLow: Dec; refHigh: Dec; refText: string | null;
  price: Dec; gstPercent: Dec; resultValue: string | null; resultNumeric: Dec; flag: string | null; remarks: string | null; resultedAt: Date | null; sortOrder: number;
};

export function itemView(i: ItemRow) {
  const refLow = n(i.refLow), refHigh = n(i.refHigh);
  return {
    id: i.id, testId: i.testId, testName: i.testName, unit: i.unit, refLow, refHigh, refText: i.refText,
    range: rangeText({ refLow, refHigh, refText: i.refText }), price: Number(i.price), gstPercent: Number(i.gstPercent),
    resultValue: i.resultValue, resultNumeric: n(i.resultNumeric), flag: i.flag, remarks: i.remarks, resultedAt: i.resultedAt,
  };
}

export const testView = (t: { id: string; name: string; code: string | null; category: string; sampleType: string | null; unit: string | null; refLow: Dec; refHigh: Dec; refText: string | null; price: Dec; gstPercent: Dec; isActive: boolean }) => ({
  id: t.id, name: t.name, code: t.code, category: t.category, sampleType: t.sampleType, unit: t.unit,
  refLow: n(t.refLow), refHigh: n(t.refHigh), refText: t.refText, price: Number(t.price), gstPercent: Number(t.gstPercent), isActive: t.isActive,
  range: rangeText({ refLow: n(t.refLow), refHigh: n(t.refHigh), refText: t.refText }),
});

/** Full order for the detail and report screens. Returns null when it is not this clinic's. */
export async function loadLabOrder(tenantId: string, id: string) {
  const o = await prisma.labOrder.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      patient: { select: { id: true, name: true, uhid: true, gender: true, dob: true, phone: true } },
      orderedBy: { select: { name: true } },
    },
  });
  if (!o) return null;
  const [tenant, inv, logs] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, phone: true } }),
    invoiceMap(tenantId, [o.invoiceId]),
    prisma.auditLog.findMany({
      where: { tenantId, entity: "LabOrder", entityId: id, action: { in: ["CANCEL", "AMEND"] } },
      orderBy: { timestamp: "asc" }, select: { action: true, diff: true, timestamp: true, actor: { select: { name: true } } },
    }),
  ]);
  const items = o.items.map(itemView);
  const cancel = logs.filter((l) => l.action === "CANCEL").pop();
  const today = istDateKey();
  return {
    id: o.id, orderNo: o.orderNo, status: o.status, clinicalNotes: o.clinicalNotes, visitId: o.visitId,
    createdAt: o.createdAt, collectedAt: o.collectedAt, resultedAt: o.resultedAt, orderedBy: o.orderedBy?.name ?? null,
    patient: { ...o.patient, dob: o.patient.dob ? o.patient.dob.toISOString().slice(0, 10) : null },
    clinic: { name: tenant?.name ?? "", address: tenant?.address ?? null, phone: tenant?.phone ?? null },
    invoice: o.invoiceId ? inv.get(o.invoiceId) ?? null : null,
    items, total: orderTotals(items).totalPaise / 100,
    cancelReason: cancel ? ((cancel.diff as { reason?: string } | null)?.reason ?? null) : null,
    amendments: logs.filter((l) => l.action === "AMEND").map((l) => ({
      at: l.timestamp, by: l.actor?.name ?? null, changes: (l.diff as { amendments?: unknown[] } | null)?.amendments ?? [],
    })),
    today,
  };
}
