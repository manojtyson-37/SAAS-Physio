import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cancelUnpaidInvoiceInTx, createInvoiceInTx } from "@/lib/hospital/invoiceTx";
import { HttpError } from "@/lib/hospital/http";
import { canLabTransition, effectiveFlag, formatLabOrderNo, resultChanged, statusAfterResults, type Flag, type LabStatus } from "./logic";

const TX = { timeout: 20_000, maxWait: 10_000 } as const;
const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));

export async function createLabOrder(a: {
  tenantId: string; userId: string; patientId: string; testIds: string[]; visitId?: string;
  clinicalNotes?: string; bill: boolean; billingOn: boolean; clientRef: string;
}) {
  const { tenantId } = a;
  return prisma.$transaction(async (tx) => {
    // Serialise retries of the same request: the second waits here, then finds the first one's order.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ":" + a.clientRef}))`;
    const replay = await tx.labOrder.findUnique({ where: { tenantId_clientRef: { tenantId, clientRef: a.clientRef } }, select: { id: true, orderNo: true, invoiceId: true } });
    if (replay) return { ...replay, replay: true };

    const patient = await tx.patient.findFirst({ where: { id: a.patientId, tenantId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new HttpError(404, "Patient not found");
    if (a.visitId) {
      const v = await tx.visit.findFirst({ where: { id: a.visitId, tenantId, deletedAt: null }, select: { patientId: true } });
      if (!v) throw new HttpError(404, "Visit not found");
      if (v.patientId !== a.patientId) throw new HttpError(400, "That visit belongs to a different patient");
    }
    const ids = [...new Set(a.testIds)];
    const tests = await tx.labTest.findMany({ where: { id: { in: ids }, tenantId, deletedAt: null, isActive: true } });
    if (tests.length !== ids.length) throw new HttpError(404, "A test is missing or switched off");
    // Keep the order the user picked them in.
    const byId = new Map(tests.map((t) => [t.id, t]));
    const ordered = ids.map((id) => byId.get(id)!);

    // The sequence bump takes the tenant row lock; it is the last contended statement before commit work, so the lock is short.
    const t = await tx.tenant.update({ where: { id: tenantId }, data: { labSeq: { increment: 1 } }, select: { labSeq: true } });
    const orderNo = formatLabOrderNo(t.labSeq);
    const order = await tx.labOrder.create({
      data: {
        tenantId, orderNo, patientId: a.patientId, visitId: a.visitId ?? null, orderedById: a.userId,
        clinicalNotes: a.clinicalNotes ?? null, clientRef: a.clientRef,
        items: {
          create: ordered.map((x, i) => ({
            testId: x.id, testName: x.name, unit: x.unit, refLow: x.refLow, refHigh: x.refHigh, refText: x.refText,
            price: x.price, gstPercent: x.gstPercent, sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });
    let invoiceId: string | null = null;
    if (a.bill && a.billingOn) {
      const inv = await createInvoiceInTx(tx, {
        tenantId, userId: a.userId, patientId: a.patientId, visitId: a.visitId, notes: `Lab ${orderNo}`,
        lines: ordered.map((x) => ({ description: `Lab: ${x.name}`, qty: 1, unitPrice: Number(x.price), gstPercent: Number(x.gstPercent) })),
      });
      invoiceId = inv.id;
      await tx.labOrder.update({ where: { id: order.id }, data: { invoiceId } });
    }
    await tx.auditLog.create({ data: { tenantId, actorId: a.userId, action: "CREATE", entity: "LabOrder", entityId: order.id } });
    return { id: order.id, orderNo, invoiceId, replay: false };
  }, TX);
}

export async function collectLabOrder(a: { tenantId: string; userId: string; id: string }) {
  return prisma.$transaction(async (tx) => {
    // Compare-and-set: two people pressing Collect cannot both win.
    const r = await tx.labOrder.updateMany({ where: { id: a.id, tenantId: a.tenantId, deletedAt: null, status: "ORDERED" }, data: { status: "COLLECTED", collectedAt: new Date() } });
    if (r.count !== 1) {
      const cur = await tx.labOrder.findFirst({ where: { id: a.id, tenantId: a.tenantId, deletedAt: null }, select: { status: true } });
      if (!cur) throw new HttpError(404, "Lab order not found");
      throw new HttpError(409, cur.status === "CANCELLED" ? "This order was cancelled" : "The sample is already collected");
    }
    await tx.auditLog.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: "UPDATE", entity: "LabOrder", entityId: a.id, diff: { status: "COLLECTED" } } });
    return { id: a.id };
  }, TX);
}

type ResultIn = { itemId: string; value: string; flag?: string | null; remarks?: string | null };

/**
 * Saves result values. Allowed once the sample is collected. Order moves to RESULTED when every item has a value.
 * Changing a value on an already RESULTED order is a correction: it is written to the audit log with old and new values.
 */
export async function saveLabResults(a: { tenantId: string; userId: string; id: string; results: ResultIn[] }) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: LabStatus }[]>`SELECT status::text AS status FROM "LabOrder" WHERE id = ${a.id} AND "tenantId" = ${a.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "Lab order not found");
    const status = rows[0].status;
    if (status === "ORDERED") throw new HttpError(409, "Collect the sample before entering results");
    if (status === "CANCELLED") throw new HttpError(409, "This order was cancelled");

    const items = await tx.labOrderItem.findMany({ where: { orderId: a.id }, orderBy: { sortOrder: "asc" } });
    const byId = new Map(items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const amendments: { test: string; from: string | null; to: string; flagFrom: string | null; flagTo: string | null }[] = [];
    const now = new Date();
    const finalValues = new Map(items.map((i) => [i.id, i.resultValue]));

    for (const r of a.results) {
      const item = byId.get(r.itemId);
      if (!item) throw new HttpError(404, "A result row does not belong to this order");
      if (seen.has(r.itemId)) throw new HttpError(400, "A test appears twice in the results");
      seen.add(r.itemId);
      if (r.value === "" && status === "RESULTED") throw new HttpError(400, `A reported result cannot be blank (${item.testName}). Enter the corrected value`);
      const value = r.value;
      if (value === "") {
        // Clearing a draft value before the order is complete.
        await tx.labOrderItem.update({ where: { id: item.id }, data: { resultValue: null, resultNumeric: null, flag: null, remarks: r.remarks || null, resultedAt: null, resultedById: null } });
        finalValues.set(item.id, null);
        continue;
      }
      const refLow = num(item.refLow), refHigh = num(item.refHigh);
      const flag = effectiveFlag(value, refLow, refHigh, (r.flag as Flag | null | undefined) ?? null);
      const numeric = /^-?\d{1,10}(\.\d+)?$/.test(value) ? (Math.round(Number(value) * 10_000) / 10_000).toString() : null;
      const changed = resultChanged(item.resultValue, value);
      if (status === "RESULTED" && (changed || item.flag !== flag) && item.resultValue !== null) {
        amendments.push({ test: item.testName, from: item.resultValue, to: value, flagFrom: item.flag, flagTo: flag });
      }
      await tx.labOrderItem.update({
        where: { id: item.id },
        data: {
          resultValue: value, resultNumeric: numeric, flag, remarks: r.remarks || null,
          // Keep the original result time for untouched values; a correction or first entry stamps now.
          ...(changed || item.flag !== flag || !item.resultedAt ? { resultedAt: now, resultedById: a.userId } : {}),
        },
      });
      finalValues.set(item.id, value);
    }

    const next = statusAfterResults(items.map((i) => finalValues.get(i.id) ?? null));
    if (status === "COLLECTED" && next === "RESULTED") {
      if (!canLabTransition("COLLECTED", "RESULTED")) throw new HttpError(409, "Invalid status change");
      await tx.labOrder.update({ where: { id: a.id }, data: { status: "RESULTED", resultedAt: now } });
    }
    await tx.auditLog.create({
      data: {
        tenantId: a.tenantId, actorId: a.userId, action: amendments.length ? "AMEND" : "UPDATE", entity: "LabOrder", entityId: a.id,
        diff: amendments.length ? { amendments } : { resultsSaved: a.results.length, status: next === "RESULTED" ? "RESULTED" : status },
      },
    });
    return { id: a.id, status: status === "RESULTED" ? "RESULTED" : next, amended: amendments.length > 0, amendments };
  }, TX);
}

export async function cancelLabOrder(a: { tenantId: string; userId: string; id: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    // Lock order everywhere: order row first, then invoice row.
    const rows = await tx.$queryRaw<{ status: LabStatus; invoiceId: string | null; orderNo: string }[]>`
      SELECT status::text AS status, "invoiceId", "orderNo" FROM "LabOrder" WHERE id = ${a.id} AND "tenantId" = ${a.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "Lab order not found");
    const o = rows[0];
    if (o.status === "CANCELLED") throw new HttpError(409, "Already cancelled");
    if (!canLabTransition(o.status, "CANCELLED")) throw new HttpError(409, "Results are already reported, so the order cannot be cancelled");
    if (o.invoiceId) {
      const ok = await cancelUnpaidInvoiceInTx(tx, a.tenantId, o.invoiceId, `Lab order ${o.orderNo} cancelled: ${a.reason}`);
      if (!ok) throw new HttpError(409, "The invoice has payments. Cancel or refund the invoice first, then cancel the order");
    }
    await tx.labOrder.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    await tx.auditLog.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: "CANCEL", entity: "LabOrder", entityId: a.id, diff: { reason: a.reason } } });
    return { id: a.id };
  }, TX);
}
