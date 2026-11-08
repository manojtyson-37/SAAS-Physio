import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { LAB_CATALOGUE_ROLES, labGate } from "@/lib/lab/gate";
import { updateLabTestSchema } from "@/lib/lab/schemas";
import { testView } from "@/lib/lab/view";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await labGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const t = await prisma.labTest.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null } });
  if (!t) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  return NextResponse.json({ test: testView(t) });
}

// Edit + active toggle (isActive). Catalogue edits never change issued orders: they hold snapshots.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await labGate(LAB_CATALOGUE_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = updateLabTestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const cur = await prisma.labTest.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: { refLow: true, refHigh: true } });
    if (!cur) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    // The range check in the schema only sees fields that were sent; check the merged result too.
    const low = parsed.data.refLow !== undefined ? parsed.data.refLow : cur.refLow == null ? null : Number(cur.refLow);
    const high = parsed.data.refHigh !== undefined ? parsed.data.refHigh : cur.refHigh == null ? null : Number(cur.refHigh);
    if (low != null && high != null && low > high) return NextResponse.json({ error: "Range low must not be above range high" }, { status: 400 });
    if (parsed.data.name) {
      const dup = await prisma.labTest.findFirst({ where: { tenantId: g.tenantId, id: { not: id }, name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
      if (dup) return NextResponse.json({ error: "A test with this name already exists" }, { status: 409 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.labTest.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null }, data: parsed.data });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "LabTest", entityId: id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A test with this name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}
