import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { stockGate } from "@/lib/pharmacy/gate";
import { updateSupplierSchema } from "@/lib/pharmacy/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await stockGate("inventory", true);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = updateSupplierSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const r = await prisma.supplier.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null }, data: parsed.data });
    if (r.count !== 1) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
