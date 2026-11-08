import { prisma } from "@/lib/db";
import { cancelUnpaidInvoiceInTx, createInvoiceInTx } from "@/lib/hospital/invoiceTx";
import { HttpError } from "@/lib/hospital/http";
import { canImgTransition, formatImagingOrderNo, fromStatuses, reportChanged, type ImagingStatus } from "./logic";

const TX = { timeout: 20_000, maxWait: 10_000 } as const;

export async function createImagingOrder(a: {
  tenantId: string; userId: string; patientId: string; studyTypeId: string; visitId?: string;
  clinicalInfo?: string; bill: boolean; billingOn: boolean; clientRef: string;
}) {
  const { tenantId } = a;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ":" + a.clientRef}))`;
    const replay = await tx.imagingOrder.findUnique({ where: { tenantId_clientRef: { tenantId, clientRef: a.clientRef } }, select: { id: true, orderNo: true, invoiceId: true } });
    if (replay) return { ...replay, replay: true };

    const patient = await tx.patient.findFirst({ where: { id: a.patientId, tenantId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new HttpError(404, "Patient not found");
    if (a.visitId) {
      const v = await tx.visit.findFirst({ where: { id: a.visitId, tenantId, deletedAt: null }, select: { patientId: true } });
      if (!v) throw new HttpError(404, "Visit not found");
      if (v.patientId !== a.patientId) throw new HttpError(400, "That visit belongs to a different patient");
    }
    const st = await tx.imagingStudyType.findFirst({ where: { id: a.studyTypeId, tenantId, deletedAt: null, isActive: true } });
    if (!st) throw new HttpError(404, "Study type is missing or switched off");

    const t = await tx.tenant.update({ where: { id: tenantId }, data: { imagingSeq: { increment: 1 } }, select: { imagingSeq: true } });
    const orderNo = formatImagingOrderNo(t.imagingSeq);
    const order = await tx.imagingOrder.create({
      data: {
        tenantId, orderNo, patientId: a.patientId, visitId: a.visitId ?? null, studyTypeId: st.id, studyName: st.name, modality: st.modality,
        bodyPart: st.bodyPart, price: st.price, gstPercent: st.gstPercent, clinicalInfo: a.clinicalInfo ?? null, orderedById: a.userId, clientRef: a.clientRef,
      },
      select: { id: true },
    });
    let invoiceId: string | null = null;
    if (a.bill && a.billingOn) {
      const inv = await createInvoiceInTx(tx, {
        tenantId, userId: a.userId, patientId: a.patientId, visitId: a.visitId, notes: `Imaging ${orderNo}`,
        lines: [{ description: `Imaging: ${st.name}`, qty: 1, unitPrice: Number(st.price), gstPercent: Number(st.gstPercent) }],
      });
      invoiceId = inv.id;
      await tx.imagingOrder.update({ where: { id: order.id }, data: { invoiceId } });
    }
    await tx.auditLog.create({ data: { tenantId, actorId: a.userId, action: "CREATE", entity: "ImagingOrder", entityId: order.id } });
    return { id: order.id, orderNo, invoiceId, replay: false };
  }, TX);
}

async function failTransition(tx: Pick<typeof prisma, "imagingOrder">, tenantId: string, id: string, to: ImagingStatus): Promise<never> {
  const cur = await tx.imagingOrder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { status: true } });
  if (!cur) throw new HttpError(404, "Imaging order not found");
  const msg: Record<string, string> = {
    CANCELLED: "This order was cancelled", REPORTED: "The report is already final. Use report correction",
  };
  if (cur.status === "CANCELLED") throw new HttpError(409, msg.CANCELLED);
  if (to === "REPORTED") throw new HttpError(409, "Mark the study as performed before reporting");
  if (to === "CANCELLED") throw new HttpError(409, "The report is already final, so the order cannot be cancelled");
  throw new HttpError(409, `Cannot move a ${cur.status.toLowerCase()} study to ${to.toLowerCase()}`);
}

/** ORDERED or SCHEDULED -> SCHEDULED (also used to re-schedule). */
export async function scheduleImaging(a: { tenantId: string; userId: string; id: string; scheduledAt: Date }) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.imagingOrder.updateMany({ where: { id: a.id, tenantId: a.tenantId, deletedAt: null, status: { in: fromStatuses("SCHEDULED") } }, data: { status: "SCHEDULED", scheduledAt: a.scheduledAt } });
    if (r.count !== 1) await failTransition(tx, a.tenantId, a.id, "SCHEDULED");
    await tx.auditLog.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: "UPDATE", entity: "ImagingOrder", entityId: a.id, diff: { status: "SCHEDULED", scheduledAt: a.scheduledAt } } });
    return { id: a.id };
  }, TX);
}

/** ORDERED or SCHEDULED -> PERFORMED. */
export async function performImaging(a: { tenantId: string; userId: string; id: string }) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.imagingOrder.updateMany({
      where: { id: a.id, tenantId: a.tenantId, deletedAt: null, status: { in: fromStatuses("PERFORMED") } },
      data: { status: "PERFORMED", performedAt: new Date(), performedById: a.userId },
    });
    if (r.count !== 1) await failTransition(tx, a.tenantId, a.id, "PERFORMED");
    await tx.auditLog.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: "UPDATE", entity: "ImagingOrder", entityId: a.id, diff: { status: "PERFORMED" } } });
    return { id: a.id };
  }, TX);
}

/**
 * PERFORMED -> REPORTED by compare-and-set. On an already REPORTED order the same call is a correction:
 * the previous text is kept in the audit log and the response says so.
 */
export async function saveImagingReport(a: { tenantId: string; userId: string; id: string; findings: string; impression?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const impression = a.impression?.trim() || null;
    const first = await tx.imagingOrder.updateMany({
      where: { id: a.id, tenantId: a.tenantId, deletedAt: null, status: { in: fromStatuses("REPORTED") } },
      data: { status: "REPORTED", findings: a.findings, impression, reportedAt: new Date(), reportedById: a.userId },
    });
    if (first.count === 1) {
      await tx.auditLog.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: "UPDATE", entity: "ImagingOrder", entityId: a.id, diff: { status: "REPORTED" } } });
      return { id: a.id, amended: false };
    }
    // Not PERFORMED: either a correction of a final report, or an invalid state. Lock the row to read it consistently.
    const rows = await tx.$queryRaw<{ status: ImagingStatus; findings: string | null; impression: string | null }[]>`
      SELECT status::text AS status, findings, impression FROM "ImagingOrder" WHERE id = ${a.id} AND "tenantId" = ${a.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "Imaging order not found");
    const cur = rows[0];
    if (cur.status !== "REPORTED") await failTransition(tx, a.tenantId, a.id, "REPORTED");
    if (!reportChanged(cur, { findings: a.findings, impression })) return { id: a.id, amended: false };
    await tx.imagingOrder.update({ where: { id: a.id }, data: { findings: a.findings, impression } });
    await tx.auditLog.create({
      data: {
        tenantId: a.tenantId, actorId: a.userId, action: "AMEND", entity: "ImagingOrder", entityId: a.id,
        diff: { previous: { findings: cur.findings, impression: cur.impression }, current: { findings: a.findings, impression } },
      },
    });
    return { id: a.id, amended: true };
  }, TX);
}

export async function cancelImaging(a: { tenantId: string; userId: string; id: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: ImagingStatus; invoiceId: string | null; orderNo: string }[]>`
      SELECT status::text AS status, "invoiceId", "orderNo" FROM "ImagingOrder" WHERE id = ${a.id} AND "tenantId" = ${a.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "Imaging order not found");
    const o = rows[0];
    if (o.status === "CANCELLED") throw new HttpError(409, "Already cancelled");
    if (!canImgTransition(o.status, "CANCELLED")) throw new HttpError(409, "The report is already final, so the order cannot be cancelled");
    if (o.invoiceId) {
      const ok = await cancelUnpaidInvoiceInTx(tx, a.tenantId, o.invoiceId, `Imaging order ${o.orderNo} cancelled: ${a.reason}`);
      if (!ok) throw new HttpError(409, "The invoice has payments. Cancel or refund the invoice first, then cancel the order");
    }
    await tx.imagingOrder.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    await tx.auditLog.create({ data: { tenantId: a.tenantId, actorId: a.userId, action: "CANCEL", entity: "ImagingOrder", entityId: a.id, diff: { reason: a.reason } } });
    return { id: a.id };
  }, TX);
}
