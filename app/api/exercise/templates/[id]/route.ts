import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, templateView, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PRESCRIBERS } from "@/lib/exercise/gate";
import { updateTemplateSchema } from "@/lib/exercise/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate();
  if (!g.session) return g.response;
  const t = await prisma.exerciseTemplate.findFirst({ where: { id: (await params).id, tenantId: g.tenantId, deletedAt: null } });
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ template: templateView(t) });
}

// Edit or activate/deactivate. Plans already issued keep their own copy of the values. Write: doctor + clinic admin.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  const parsed = updateTemplateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id } = await params;
  const d = parsed.data;
  const data: Prisma.ExerciseTemplateUpdateManyMutationInput = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.category !== undefined) data.category = d.category;
  if (d.description !== undefined) data.description = d.description || null;
  if (d.instructions !== undefined) data.instructions = d.instructions || null;
  if (d.sets !== undefined) data.sets = d.sets;
  if (d.reps !== undefined) data.reps = d.reps;
  if (d.holdSeconds !== undefined) data.holdSeconds = d.holdSeconds;
  if (d.isActive !== undefined) data.isActive = d.isActive;
  try {
    await prisma.$transaction(async (tx) => {
      if (d.name !== undefined) {
        const clash = await tx.exerciseTemplate.findFirst({ where: { tenantId: g.tenantId, id: { not: id }, name: { equals: d.name, mode: "insensitive" } }, select: { id: true } });
        if (clash) throw new HttpError(409, "A template with this name already exists");
      }
      const r = await tx.exerciseTemplate.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null }, data });
      if (r.count !== 1) throw new HttpError(404, "Template not found");
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "ExerciseTemplate", id);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A template with this name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}

// Soft delete. The name is freed (suffix) so it can be reused; existing plans are unaffected (they hold copies).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;
  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.exerciseTemplate.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: { name: true } });
      if (!t) throw new HttpError(404, "Template not found");
      await tx.exerciseTemplate.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, name: `${t.name.slice(0, 100)} (removed ${id.slice(0, 8)})` } });
      await audit(tx, g.tenantId, g.session.userId, "DELETE", "ExerciseTemplate", id);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
