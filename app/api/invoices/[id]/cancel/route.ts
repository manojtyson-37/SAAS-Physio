import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { cancelInvoiceSchema } from "@/lib/hospital/billingSchemas";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";

/** Cancelling keeps the invoice (and its number) on record, which tax rules require. Refunds are not supported yet, so an invoice with payments cannot be cancelled. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;
  const { id } = await params;

  const parsed = cancelInvoiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS status FROM "Invoice" WHERE "id" = ${id} AND "tenantId" = ${g.tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
        if (!locked[0]) throw new HttpError(404, "Not found");
        if (locked[0].status === "CANCELLED") throw new HttpError(409, "Invoice is already cancelled");
        if ((await tx.payment.count({ where: { invoiceId: id } })) > 0) {
          throw new HttpError(409, "This invoice has payments. Refunds are not supported yet, so it cannot be cancelled");
        }
        await tx.invoice.update({
          where: { id },
          data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: parsed.data.reason },
        });
        await tx.auditLog.create({
          data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CANCEL", entity: "Invoice", entityId: id },
        });
      },
      { timeout: 20_000, maxWait: 10_000 }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
