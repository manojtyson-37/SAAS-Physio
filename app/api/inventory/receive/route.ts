import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { stockGate } from "@/lib/pharmacy/gate";
import { receiveSchema } from "@/lib/pharmacy/schemas";

/** Goods received: adds stock to a batch (creating the batch the first time its number is seen). */
export async function POST(req: NextRequest) {
  const g = await stockGate("inventory", true);
  if (!g.session) return g.response;
  const parsed = receiveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  try {
    const batchId = await prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findFirst({ where: { id: d.itemId, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
      if (!item) throw new HttpError(404, "Item not found");
      if (d.supplierId) {
        const s = await tx.supplier.findFirst({ where: { id: d.supplierId, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
        if (!s) throw new HttpError(404, "Supplier not found");
      }
      // Atomic upsert: two people receiving the same batch at once both add their quantity; neither is lost.
      // Re-receiving a batch must carry the same expiry, otherwise it is a different batch with a mistyped number.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "StockBatch" (id, "tenantId", "itemId", "supplierId", "batchNo", "expiryDate", "qtyOnHand", "costPrice", "salePrice", "receivedAt")
        VALUES (${randomUUID()}, ${g.tenantId}, ${d.itemId}, ${d.supplierId ?? null}, ${d.batchNo}, ${d.expiryDate ?? null}::date, ${d.qty}, COALESCE(${d.costPrice ?? null}::numeric, 0), ${d.salePrice}, now())
        ON CONFLICT ("itemId", "batchNo") DO UPDATE
          SET "qtyOnHand" = "StockBatch"."qtyOnHand" + EXCLUDED."qtyOnHand",
              "costPrice" = COALESCE(${d.costPrice ?? null}::numeric, "StockBatch"."costPrice"), "salePrice" = EXCLUDED."salePrice",
              "supplierId" = COALESCE(EXCLUDED."supplierId", "StockBatch"."supplierId")
          WHERE "StockBatch"."deletedAt" IS NULL AND "StockBatch"."expiryDate" IS NOT DISTINCT FROM EXCLUDED."expiryDate"
        RETURNING id`;
      if (rows.length === 0) throw new HttpError(409, "That batch number already exists with a different expiry date. Check the batch number and expiry");
      await tx.stockMovement.create({
        data: { tenantId: g.tenantId, itemId: d.itemId, batchId: rows[0].id, type: "RECEIPT", qty: d.qty, note: d.note ?? null, createdById: g.session.userId },
      });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "StockReceipt", entityId: rows[0].id } });
      return rows[0].id;
    });
    return NextResponse.json({ batchId }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
