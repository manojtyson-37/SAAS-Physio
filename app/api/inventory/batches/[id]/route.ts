import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { stockGate } from "@/lib/pharmacy/gate";
import { batchUpdateSchema } from "@/lib/pharmacy/schemas";

/** Correct a batch's selling or cost price (past dispensings keep the price they were sold at). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await stockGate("inventory", true);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = batchUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const n = await prisma.$transaction(async (tx) => {
      const r = await tx.stockBatch.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null }, data: parsed.data });
      if (r.count === 1) await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "StockBatch", entityId: id } });
      return r.count;
    });
    if (n !== 1) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
