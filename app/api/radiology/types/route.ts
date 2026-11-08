import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_CATALOGUE_ROLES, radGate } from "@/lib/radiology/gate";
import { studyTypeSchema } from "@/lib/radiology/schemas";
import { typeView } from "@/lib/radiology/view";

// Read: any clinic role. Write: STAFF + CLINIC_ADMIN (operational catalogue).
export async function GET(req: NextRequest) {
  const g = await radGate();
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const where: Prisma.ImagingStudyTypeWhereInput = { tenantId: g.tenantId, deletedAt: null };
  if (sp.get("inactive") !== "1") where.isActive = true;
  const q = sp.get("q")?.trim();
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { bodyPart: { contains: q, mode: "insensitive" } }];
  const types = await prisma.imagingStudyType.findMany({ where, orderBy: [{ modality: "asc" }, { name: "asc" }], take: 500 });
  return NextResponse.json({ types: types.map(typeView) });
}

export async function POST(req: NextRequest) {
  const g = await radGate(RAD_CATALOGUE_ROLES);
  if (!g.session) return g.response;
  const parsed = studyTypeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const dup = await prisma.imagingStudyType.findFirst({ where: { tenantId: g.tenantId, name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
    if (dup) return NextResponse.json({ error: "A study type with this name already exists" }, { status: 409 });
    const type = await prisma.$transaction(async (tx) => {
      const created = await tx.imagingStudyType.create({ data: { ...parsed.data, tenantId: g.tenantId }, select: { id: true } });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "ImagingStudyType", entityId: created.id } });
      return created;
    });
    return NextResponse.json({ type }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A study type with this name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}
