import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { requireTenantSession } from "@/lib/hospital/guard";
import { computeInvoice, paiseToDecimal, toPaise } from "@/lib/hospital/billing";
import { updateInvoiceSchema } from "@/lib/hospital/billingSchemas";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { amountInWords } from "@/lib/hospital/words";

const num = (d: { toString(): string }) => Number(d.toString());

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const off = await moduleGate(session, "billing");
  if (off) return off;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, deletedAt: null, ...tenantScope(session) },
    include: {
      patient: { select: { id: true, name: true, phone: true, address: true, uhid: true } },
      tenant: { select: { name: true, address: true, phone: true, email: true, gstNumber: true } },
      visit: { select: { id: true, tokenNumber: true, tokenDate: true, type: true } },
      createdBy: { select: { name: true } },
      lineItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      payments: { orderBy: { date: "asc" }, include: { receivedBy: { select: { name: true } } } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalPaise = toPaise(num(invoice.total));
  const paidPaise = toPaise(num(invoice.paidAmount));
  const balancePaise = invoice.status === "CANCELLED" ? 0 : Math.max(0, totalPaise - paidPaise);

  return NextResponse.json({
    invoice: {
      ...invoice,
      subtotal: num(invoice.subtotal),
      gst: num(invoice.gst),
      discount: num(invoice.discount),
      total: num(invoice.total),
      paidAmount: num(invoice.paidAmount),
      balance: balancePaise / 100,
      totalInWords: amountInWords(totalPaise),
      lineItems: invoice.lineItems.map((li) => ({
        ...li,
        unitPrice: num(li.unitPrice),
        gstPercent: num(li.gstPercent),
        lineTotal: num(li.lineTotal),
      })),
      payments: invoice.payments.map((p) => ({ ...p, amount: num(p.amount) })),
    },
  });
}

/** Edit line items / discount / notes. Only while nothing has been collected and the invoice is not cancelled. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "STAFF"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "billing");
  if (off) return off;
  const { id } = await params;

  const parsed = updateInvoiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const computed = computeInvoice(parsed.data.lineItems, parsed.data.discount);

    const updated = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS status FROM "Invoice" WHERE "id" = ${id} AND "tenantId" = ${g.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
        if (!locked[0]) throw new HttpError(404, "Not found");
        if (locked[0].status === "CANCELLED") throw new HttpError(409, "A cancelled invoice cannot be edited");
        const paid = await tx.payment.count({ where: { invoiceId: id } });
        if (paid > 0) throw new HttpError(409, "This invoice already has payments and can no longer be edited");

        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        const inv = await tx.invoice.update({
          where: { id },
          data: {
            subtotal: paiseToDecimal(computed.subtotalPaise),
            gst: paiseToDecimal(computed.gstPaise),
            discount: paiseToDecimal(computed.discountPaise),
            total: paiseToDecimal(computed.totalPaise),
            notes: parsed.data.notes || null,
            lineItems: {
              create: computed.lines.map((l, idx) => ({
                sortOrder: idx,
                description: l.description,
                qty: l.qty,
                unitPrice: paiseToDecimal(toPaise(l.unitPrice)),
                gstPercent: l.gstPercent.toFixed(2),
                lineTotal: paiseToDecimal(l.lineTotalPaise),
              })),
            },
          },
          select: { id: true, number: true },
        });
        await tx.auditLog.create({
          data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "Invoice", entityId: id },
        });
        return inv;
      },
      { timeout: 20_000, maxWait: 10_000 }
    );
    return NextResponse.json({ invoice: updated });
  } catch (e) {
    return toErrorResponse(e);
  }
}
