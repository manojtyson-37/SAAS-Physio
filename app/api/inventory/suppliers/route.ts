import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { stockGate } from "@/lib/pharmacy/gate";
import { supplierSchema } from "@/lib/pharmacy/schemas";

export async function GET() {
  const g = await stockGate("inventory", false);
  if (!g.session) return g.response;
  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: g.tenantId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, gstin: true, address: true, isActive: true },
  });
  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const g = await stockGate("inventory", true);
  if (!g.session) return g.response;
  const parsed = supplierSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const dup = await prisma.supplier.findFirst({ where: { tenantId: g.tenantId, name: parsed.data.name }, select: { id: true } });
    if (dup) return NextResponse.json({ error: "A supplier with this name already exists" }, { status: 409 });
    const supplier = await prisma.supplier.create({ data: { ...parsed.data, tenantId: g.tenantId }, select: { id: true } });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
