import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { LAB_CATALOGUE_ROLES, labGate } from "@/lib/lab/gate";
import { labTestSchema } from "@/lib/lab/schemas";
import { testView } from "@/lib/lab/view";

// Read: any clinic role (doctors pick tests). Write: STAFF + CLINIC_ADMIN (operational catalogue).
export async function GET(req: NextRequest) {
  const g = await labGate();
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const where: Prisma.LabTestWhereInput = { tenantId: g.tenantId, deletedAt: null };
  if (sp.get("inactive") !== "1") where.isActive = true;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  const tests = await prisma.labTest.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }], take: 1000 });
  return NextResponse.json({ tests: tests.map(testView) });
}

export async function POST(req: NextRequest) {
  const g = await labGate(LAB_CATALOGUE_ROLES);
  if (!g.session) return g.response;
  const parsed = labTestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const dup = await prisma.labTest.findFirst({ where: { tenantId: g.tenantId, name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
    if (dup) return NextResponse.json({ error: "A test with this name already exists" }, { status: 409 });
    const test = await prisma.$transaction(async (tx) => {
      const created = await tx.labTest.create({ data: { ...parsed.data, tenantId: g.tenantId }, select: { id: true } });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "LabTest", entityId: created.id } });
      return created;
    });
    return NextResponse.json({ test }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A test with this name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}
