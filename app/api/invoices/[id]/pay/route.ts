import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { checkPayment, paiseToDecimal, toPaise } from "@/lib/hospital/billing";
import { paymentSchema } from "@/lib/hospital/billingSchemas";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "STAFF"]);
  if (!g.session) return g.response;
  const { id } = await params;

  const parsed = paymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { method, amount, reference, clientRef } = parsed.data;
  const amountPaise = toPaise(amount);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Row lock: concurrent payments on one invoice queue up here, so the balance check below is race free.
        const rows = await tx.$queryRaw<{ status: string; total: string; paid: string }[]>`SELECT "status"::text AS status, "total"::text AS total, "paidAmount"::text AS paid FROM "Invoice" WHERE "id" = ${id} AND "tenantId" = ${g.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
        const inv = rows[0];
        if (!inv) throw new HttpError(404, "Not found");

        if (clientRef) {
          const dup = await tx.payment.findUnique({
            where: { invoiceId_clientRef: { invoiceId: id, clientRef } },
            select: { id: true },
          });
          if (dup) return { paymentId: dup.id, status: inv.status, paidAmount: Number(inv.paid), duplicate: true };
        }

        const check = checkPayment(
          { status: inv.status, totalPaise: toPaise(Number(inv.total)), paidPaise: toPaise(Number(inv.paid)) },
          amountPaise
        );
        if (!check.ok) throw new HttpError(409, check.error);

        const payment = await tx.payment.create({
          data: {
            invoiceId: id,
            method,
            amount: paiseToDecimal(amountPaise),
            reference: reference || null,
            clientRef: clientRef || null,
            receivedById: g.session.userId,
          },
          select: { id: true },
        });
        await tx.invoice.update({
          where: { id },
          data: { paidAmount: paiseToDecimal(check.newPaidPaise), status: check.status },
        });
        await tx.auditLog.create({
          data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "Payment", entityId: payment.id },
        });
        return { paymentId: payment.id, status: check.status, paidAmount: check.newPaidPaise / 100, duplicate: false };
      },
      { timeout: 20_000, maxWait: 10_000 }
    );
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
