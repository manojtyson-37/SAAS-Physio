import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { istDateKey } from "@/lib/hospital/dates";
import { toErrorResponse } from "@/lib/hospital/http";
import { stockGate } from "@/lib/pharmacy/gate";
import { updateStockItemSchema } from "@/lib/pharmacy/schemas";
import { dayOf, itemView } from "@/lib/pharmacy/view";
import { expiryStatus } from "@/lib/pharmacy/stock";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await stockGate("inventory", false);
  if (!g.session) return g.response;
  const { id } = await params;
  const today = istDateKey();
  const item = await prisma.stockItem.findFirst({
    where: { id, tenantId: g.tenantId, deletedAt: null },
    include: {
      batches: { where: { deletedAt: null }, orderBy: [{ expiryDate: "asc" }, { id: "asc" }], include: { supplier: { select: { name: true } } } },
      movements: { orderBy: { createdAt: "desc" }, take: 40, include: { batch: { select: { batchNo: true } }, createdBy: { select: { name: true } } } },
    },
  });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({
    item: itemView(item, item.batches, today),
    batches: item.batches.map((b) => ({
      id: b.id, batchNo: b.batchNo, expiryDate: dayOf(b.expiryDate), expiryStatus: expiryStatus(dayOf(b.expiryDate), today),
      qtyOnHand: b.qtyOnHand, costPrice: Number(b.costPrice), salePrice: Number(b.salePrice), supplier: b.supplier?.name ?? null,
    })),
    movements: item.movements.map((m) => ({ id: m.id, type: m.type, qty: m.qty, note: m.note, batchNo: m.batch.batchNo, by: m.createdBy?.name ?? null, at: m.createdAt })),
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await stockGate("inventory", true);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = updateStockItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const done = await prisma.$transaction(async (tx) => {
      const r = await tx.stockItem.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null }, data: parsed.data });
      if (r.count === 1) await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "StockItem", entityId: id } });
      return r.count;
    });
    if (done !== 1) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
