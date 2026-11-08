import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, SETUP_ROLES } from "@/lib/ipd/gate";
import { bedSchema } from "@/lib/ipd/schemas";

// Clinic admin only.
export async function POST(req: NextRequest) {
  const g = await ipdGate("ipd", SETUP_ROLES);
  if (!g.session) return g.response;
  const parsed = bedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const ward = await prisma.ward.findFirst({ where: { id: parsed.data.wardId, tenantId: g.tenantId }, select: { id: true } });
    if (!ward) return NextResponse.json({ error: "Ward not found" }, { status: 404 });
    const bed = await prisma.bed.create({
      data: { tenantId: g.tenantId, wardId: ward.id, label: parsed.data.label, dailyRate: parsed.data.dailyRate.toFixed(2) },
      select: { id: true, label: true, dailyRate: true, isActive: true, wardId: true },
    });
    await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "Bed", entityId: bed.id } });
    return NextResponse.json({ bed: { ...bed, dailyRate: Number(bed.dailyRate) } }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "That ward already has a bed with this label" }, { status: 409 });
    return toErrorResponse(e);
  }
}
