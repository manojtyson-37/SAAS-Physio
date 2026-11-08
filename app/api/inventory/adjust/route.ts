import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { stockGate } from "@/lib/pharmacy/gate";
import { adjustSchema } from "@/lib/pharmacy/schemas";

/** Stock count correction or write-off (expired, damaged). Never takes a batch below zero. */
export async function POST(req: NextRequest) {
  const g = await stockGate("inventory", true);
  if (!g.session) return g.response;
  const parsed = adjustSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { batchId, delta, type, note } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const batch = await tx.stockBatch.findFirst({ where: { id: batchId, tenantId: g.tenantId, deletedAt: null }, select: { itemId: true } });
      if (!batch) throw new HttpError(404, "Batch not found");
      const r = await tx.stockBatch.updateMany({
        where: { id: batchId, tenantId: g.tenantId, ...(delta < 0 ? { qtyOnHand: { gte: -delta } } : {}) },
        data: { qtyOnHand: { increment: delta } },
      });
      if (r.count !== 1) throw new HttpError(409, "Not enough stock in that batch for this change");
      await tx.stockMovement.create({ data: { tenantId: g.tenantId, itemId: batch.itemId, batchId, type, qty: delta, note, createdById: g.session.userId } });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "StockBatch", entityId: batchId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
