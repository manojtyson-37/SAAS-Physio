import type { Prisma } from "@prisma/client";
import { computeInvoice, formatInvoiceNumber, paiseToDecimal, toPaise, type LineInput } from "./billing";

/**
 * Creates an UNPAID invoice inside the caller's transaction (so the invoice number is rolled back with it).
 * Every module that bills (pharmacy, lab, imaging, dental plans, IPD bed charges) uses this one function.
 * Caller must have checked that the billing module is on and that patient/visit belong to the tenant.
 */
export async function createInvoiceInTx(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; userId: string; patientId: string; visitId?: string | null; lines: LineInput[]; discount?: number; notes?: string }
) {
  const computed = computeInvoice(args.lines, args.discount ?? 0);
  const t = await tx.tenant.update({ where: { id: args.tenantId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } });
  const invoice = await tx.invoice.create({
    data: {
      tenantId: args.tenantId, patientId: args.patientId, visitId: args.visitId ?? null, createdById: args.userId,
      number: formatInvoiceNumber(t.invoiceSeq), subtotal: paiseToDecimal(computed.subtotalPaise), gst: paiseToDecimal(computed.gstPaise),
      discount: paiseToDecimal(computed.discountPaise), total: paiseToDecimal(computed.totalPaise), notes: args.notes ?? null, status: "UNPAID",
      lineItems: {
        create: computed.lines.map((l, idx) => ({
          sortOrder: idx, description: l.description.slice(0, 200), qty: l.qty, unitPrice: paiseToDecimal(toPaise(l.unitPrice)),
          gstPercent: l.gstPercent.toFixed(2), lineTotal: paiseToDecimal(l.lineTotalPaise),
        })),
      },
    },
    select: { id: true, number: true },
  });
  await tx.auditLog.create({ data: { tenantId: args.tenantId, actorId: args.userId, action: "CREATE", entity: "Invoice", entityId: invoice.id } });
  return { id: invoice.id, number: invoice.number, totalPaise: computed.totalPaise };
}

/** Cancels an invoice that has no payments, inside the caller's transaction; returns false when it already has payments. */
export async function cancelUnpaidInvoiceInTx(tx: Prisma.TransactionClient, tenantId: string, invoiceId: string, reason: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ status: string; paid: string }[]>`SELECT status::text AS status, "paidAmount"::text AS paid FROM "Invoice" WHERE id = ${invoiceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (rows.length === 0 || rows[0].status === "CANCELLED") return true;
  if (Number(rows[0].paid) > 0) return false;
  await tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.slice(0, 300) } });
  return true;
}
