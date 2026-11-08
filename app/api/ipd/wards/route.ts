import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, SETUP_ROLES } from "@/lib/ipd/gate";
import { wardSchema } from "@/lib/ipd/schemas";

const bedSelect = { id: true, label: true, dailyRate: true, isActive: true } as const;

// Reads: any clinic user (the admit form needs the list). Writes: clinic admin only (setup).
export async function GET() {
  const g = await ipdGate("ipd");
  if (!g.session) return g.response;
  const wards = await prisma.ward.findMany({
    where: { tenantId: g.tenantId }, orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, isActive: true, beds: { orderBy: { label: "asc" }, select: bedSelect } },
  });
  return NextResponse.json({ wards: wards.map((w) => ({ ...w, beds: w.beds.map((b) => ({ ...b, dailyRate: Number(b.dailyRate) })) })) });
}

export async function POST(req: NextRequest) {
  const g = await ipdGate("ipd", SETUP_ROLES);
  if (!g.session) return g.response;
  const parsed = wardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const ward = await prisma.ward.create({ data: { tenantId: g.tenantId, ...parsed.data }, select: { id: true, name: true, type: true, isActive: true } });
    await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "Ward", entityId: ward.id } });
    return NextResponse.json({ ward }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A ward with that name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}
