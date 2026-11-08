import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { istDateKey } from "@/lib/hospital/dates";
import { toErrorResponse } from "@/lib/hospital/http";
import { stockGate } from "@/lib/pharmacy/gate";
import { stockItemSchema } from "@/lib/pharmacy/schemas";
import { itemView, stockAlerts } from "@/lib/pharmacy/view";

const FILTERS = ["low", "out", "expiring", "expired"] as const;

export async function GET(req: NextRequest) {
  const g = await stockGate("inventory", false);
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const today = istDateKey();
  const q = sp.get("q")?.trim();
  const filter = sp.get("filter");
  if (filter && !(FILTERS as readonly string[]).includes(filter)) return NextResponse.json({ error: "Invalid filter" }, { status: 400 });

  const where: Prisma.StockItemWhereInput = { tenantId: g.tenantId, deletedAt: null };
  if (sp.get("inactive") !== "1") where.isActive = true;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }];

  const items = await prisma.stockItem.findMany({
    where,
    orderBy: { name: "asc" },
    take: 500,
    include: { batches: { where: { deletedAt: null, qtyOnHand: { gt: 0 } }, select: { id: true, batchNo: true, expiryDate: true, qtyOnHand: true, salePrice: true } } },
  });
  let rows = items.map((i) => itemView(i, i.batches, today));
  if (filter === "low") rows = rows.filter((r) => r.level === "LOW");
  if (filter === "out") rows = rows.filter((r) => r.level === "OUT");
  if (filter === "expiring") rows = rows.filter((r) => r.nextExpiryStatus === "EXPIRING");
  if (filter === "expired") rows = rows.filter((r) => r.expiredQty > 0);
  return NextResponse.json({ items: rows, alerts: await stockAlerts(g.tenantId, today) });
}

export async function POST(req: NextRequest) {
  const g = await stockGate("inventory", true);
  if (!g.session) return g.response;
  const parsed = stockItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const dup = await prisma.stockItem.findFirst({
      where: {
        tenantId: g.tenantId, deletedAt: null,
        name: { equals: parsed.data.name, mode: "insensitive" },
        strength: parsed.data.strength ?? null, form: parsed.data.form ?? null, brand: parsed.data.brand ?? null,
      },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ error: "This item already exists in your stock list" }, { status: 409 });
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.stockItem.create({ data: { ...parsed.data, tenantId: g.tenantId }, select: { id: true } });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "StockItem", entityId: created.id } });
      return created;
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
