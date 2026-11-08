import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_CATALOGUE_ROLES, radGate } from "@/lib/radiology/gate";
import { updateStudyTypeSchema } from "@/lib/radiology/schemas";
import { typeView } from "@/lib/radiology/view";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await radGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const t = await prisma.imagingStudyType.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null } });
  if (!t) return NextResponse.json({ error: "Study type not found" }, { status: 404 });
  return NextResponse.json({ type: typeView(t) });
}

// Edit + active toggle. Issued orders hold snapshots, so edits never change them.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await radGate(RAD_CATALOGUE_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = updateStudyTypeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    if (parsed.data.name) {
      const dup = await prisma.imagingStudyType.findFirst({ where: { tenantId: g.tenantId, id: { not: id }, name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
      if (dup) return NextResponse.json({ error: "A study type with this name already exists" }, { status: 409 });
    }
    const n = await prisma.$transaction(async (tx) => {
      const r = await tx.imagingStudyType.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null }, data: parsed.data });
      if (r.count === 1) await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "ImagingStudyType", entityId: id } });
      return r.count;
    });
    if (n !== 1) return NextResponse.json({ error: "Study type not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A study type with this name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}
