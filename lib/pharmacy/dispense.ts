import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeInvoice, formatInvoiceNumber, paiseToDecimal, toPaise } from "@/lib/hospital/billing";
import { istDateKey } from "@/lib/hospital/dates";
import { HttpError } from "@/lib/hospital/http";
import { allocateFefo, StockError } from "./stock";
import { stockLabel } from "./view";

const TX = { timeout: 20_000, maxWait: 10_000 } as const;

type LockedBatch = { id: string; batchNo: string; expiryDate: string | null; qtyOnHand: number; salePrice: number };

/**
 * Locks the item's batches (FOR UPDATE, stable order) so two counters cannot sell the same last strip,
 * and returns them oldest-expiry first.
 */
async function lockBatches(tx: Prisma.TransactionClient, tenantId: string, itemId: string): Promise<LockedBatch[]> {
  return tx.$queryRaw<LockedBatch[]>`
    SELECT id, "batchNo", to_char("expiryDate", 'YYYY-MM-DD') AS "expiryDate", "qtyOnHand", "salePrice"::float8 AS "salePrice"
    FROM "StockBatch"
    WHERE "tenantId" = ${tenantId} AND "itemId" = ${itemId} AND "deletedAt" IS NULL AND "qtyOnHand" > 0
    ORDER BY "expiryDate" ASC NULLS LAST, id
    FOR UPDATE`;
}

export type DispenseInput = {
  tenantId: string;
  userId: string;
  patientId: string;
  visitId?: string;
  prescriptionId?: string;
  lines: { itemId: string; qty: number }[];
  discount: number;
  notes?: string;
  clientRef: string;
  refill?: boolean;
  billingOn: boolean;
};

export async function dispense(input: DispenseInput) {
  const { tenantId } = input;
  const today = istDateKey();

  return prisma.$transaction(async (tx) => {
    // Serialise retries of the same request: the second one waits here, then finds the first one's result.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ":" + input.clientRef}))`;
    const replay = await tx.dispensation.findUnique({
      where: { tenantId_clientRef: { tenantId, clientRef: input.clientRef } },
      select: { id: true, invoice: { select: { id: true, number: true } }, total: true },
    });
    if (replay) return { id: replay.id, invoiceId: replay.invoice?.id ?? null, invoiceNumber: replay.invoice?.number ?? null, total: Number(replay.total), replay: true };

    const patient = await tx.patient.findFirst({ where: { id: input.patientId, tenantId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new HttpError(404, "Patient not found");
    if (input.visitId) {
      const v = await tx.visit.findFirst({ where: { id: input.visitId, tenantId, deletedAt: null }, select: { patientId: true } });
      if (!v) throw new HttpError(404, "Visit not found");
      if (v.patientId !== input.patientId) throw new HttpError(400, "That visit belongs to a different patient");
    }
    if (input.prescriptionId) {
      // Row lock: two counters cannot dispense the same prescription at the same moment.
      const locked = await tx.$queryRaw<{ patientId: string }[]>`SELECT "patientId" FROM "Prescription" WHERE id = ${input.prescriptionId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      if (locked.length === 0) throw new HttpError(404, "Prescription not found");
      if (locked[0].patientId !== input.patientId) throw new HttpError(400, "That prescription belongs to a different patient");
      const prior = await tx.dispensation.count({ where: { prescriptionId: input.prescriptionId, status: "COMPLETED" } });
      if (prior > 0 && !input.refill) throw new HttpError(409, "This prescription was already dispensed. Tick refill to dispense it again");
    }

    // One entry per item, processed in id order so concurrent dispenses lock batches in the same order.
    const wanted = new Map<string, number>();
    for (const l of input.lines) wanted.set(l.itemId, (wanted.get(l.itemId) ?? 0) + l.qty);
    const itemIds = [...wanted.keys()].sort();
    const items = await tx.stockItem.findMany({ where: { id: { in: itemIds }, tenantId, deletedAt: null, isActive: true } });
    if (items.length !== itemIds.length) throw new HttpError(404, "An item is missing or switched off");
    const byId = new Map(items.map((i) => [i.id, i]));

    const picks: { itemId: string; batchId: string; batchNo: string; qty: number; unitPrice: number; gstPercent: number; description: string }[] = [];
    try {
      for (const itemId of itemIds) {
        const item = byId.get(itemId)!;
        const batches = await lockBatches(tx, tenantId, itemId);
        for (const a of allocateFefo(batches, wanted.get(itemId)!, today, stockLabel(item))) {
          picks.push({
            itemId, batchId: a.batchId, batchNo: a.batchNo, qty: a.qty, unitPrice: a.unitPrice, gstPercent: Number(item.gstPercent),
            description: `${stockLabel(item)} (batch ${a.batchNo})`.slice(0, 200),
          });
        }
      }
    } catch (e) {
      if (e instanceof StockError) throw new HttpError(409, e.message);
      throw e;
    }

    const computed = computeInvoice(picks.map((p) => ({ description: p.description, qty: p.qty, unitPrice: p.unitPrice, gstPercent: p.gstPercent })), input.discount);

    for (const p of picks) {
      const done = await tx.stockBatch.updateMany({ where: { id: p.batchId, tenantId, qtyOnHand: { gte: p.qty } }, data: { qtyOnHand: { decrement: p.qty } } });
      if (done.count !== 1) throw new HttpError(409, "Stock changed while dispensing, please try again");
    }

    const disp = await tx.dispensation.create({
      data: {
        tenantId, patientId: input.patientId, visitId: input.visitId ?? null, prescriptionId: input.prescriptionId ?? null,
        clientRef: input.clientRef, dispensedById: input.userId, notes: input.notes ?? null,
        total: paiseToDecimal(computed.totalPaise),
        lines: {
          create: picks.map((p, idx) => ({
            itemId: p.itemId, batchId: p.batchId, qty: p.qty, unitPrice: paiseToDecimal(toPaise(p.unitPrice)), gstPercent: p.gstPercent.toFixed(2),
            lineTotal: paiseToDecimal(computed.lines[idx].lineTotalPaise),
          })),
        },
      },
      select: { id: true },
    });
    await tx.stockMovement.createMany({
      data: picks.map((p) => ({ tenantId, itemId: p.itemId, batchId: p.batchId, type: "DISPENSE" as const, qty: -p.qty, dispensationId: disp.id, createdById: input.userId })),
    });

    let invoice: { id: string; number: string } | null = null;
    if (input.billingOn) {
      const t = await tx.tenant.update({ where: { id: tenantId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } });
      invoice = await tx.invoice.create({
        data: {
          tenantId, patientId: input.patientId, visitId: input.visitId ?? null, createdById: input.userId, number: formatInvoiceNumber(t.invoiceSeq),
          subtotal: paiseToDecimal(computed.subtotalPaise), gst: paiseToDecimal(computed.gstPaise), discount: paiseToDecimal(computed.discountPaise),
          total: paiseToDecimal(computed.totalPaise), notes: "Pharmacy", status: "UNPAID",
          lineItems: {
            create: computed.lines.map((l, idx) => ({
              sortOrder: idx, description: l.description, qty: l.qty, unitPrice: paiseToDecimal(toPaise(l.unitPrice)),
              gstPercent: l.gstPercent.toFixed(2), lineTotal: paiseToDecimal(l.lineTotalPaise),
            })),
          },
        },
        select: { id: true, number: true },
      });
      await tx.dispensation.update({ where: { id: disp.id }, data: { invoiceId: invoice.id } });
      await tx.auditLog.create({ data: { tenantId, actorId: input.userId, action: "CREATE", entity: "Invoice", entityId: invoice.id } });
    }
    await tx.auditLog.create({ data: { tenantId, actorId: input.userId, action: "CREATE", entity: "Dispensation", entityId: disp.id } });
    return { id: disp.id, invoiceId: invoice?.id ?? null, invoiceNumber: invoice?.number ?? null, total: computed.totalPaise / 100, replay: false };
  }, TX);
}

/** Reverses a dispensation: stock goes back to the batches it came from; an unpaid pharmacy invoice is cancelled. */
export async function voidDispensation(args: { tenantId: string; userId: string; id: string; reason: string }) {
  const { tenantId, id } = args;
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: string; invoiceId: string | null }[]>`
      SELECT status::text AS status, "invoiceId" FROM "Dispensation" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    if (locked.length === 0) throw new HttpError(404, "Dispensation not found");
    if (locked[0].status !== "COMPLETED") throw new HttpError(409, "Already voided");

    const lines = await tx.dispensationLine.findMany({ where: { dispensationId: id }, select: { itemId: true, batchId: true, qty: true } });
    // Same lock order as dispense (item, expiry, id) so the two can never deadlock each other.
    await tx.$queryRaw`SELECT id FROM "StockBatch" WHERE id = ANY(${lines.map((l) => l.batchId)}) ORDER BY "itemId", "expiryDate" ASC NULLS LAST, id FOR UPDATE`;

    if (locked[0].invoiceId) {
      // Row lock shared with the payment and cancel routes: a payment cannot slip in while we cancel.
      const inv = await tx.$queryRaw<{ status: string; paid: string }[]>`SELECT status::text AS status, "paidAmount"::text AS paid FROM "Invoice" WHERE id = ${locked[0].invoiceId} FOR UPDATE`;
      if (inv[0] && Number(inv[0].paid) > 0 && inv[0].status !== "CANCELLED") {
        throw new HttpError(409, "The invoice has payments. Cancel the invoice first, then void the dispensation");
      }
      if (inv[0] && inv[0].status !== "CANCELLED") {
        await tx.invoice.update({ where: { id: locked[0].invoiceId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: `Dispensing voided: ${args.reason}` } });
      }
    }

    for (const l of lines) {
      await tx.stockBatch.update({ where: { id: l.batchId }, data: { qtyOnHand: { increment: l.qty } } });
    }
    await tx.stockMovement.createMany({
      data: lines.map((l) => ({ tenantId, itemId: l.itemId, batchId: l.batchId, type: "VOID_RETURN" as const, qty: l.qty, note: args.reason, dispensationId: id, createdById: args.userId })),
    });
    await tx.dispensation.update({ where: { id }, data: { status: "VOIDED", voidReason: args.reason, voidedAt: new Date() } });
    await tx.auditLog.create({ data: { tenantId, actorId: args.userId, action: "UPDATE", entity: "Dispensation", entityId: id } });
    return { id };
  }, TX);
}
