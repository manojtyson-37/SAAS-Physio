import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, lockPlan, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PRESCRIBERS } from "@/lib/exercise/gate";
import { isValidReorder, snapshotFromTemplate } from "@/lib/exercise/logic";
import { itemInputSchema, reorderSchema } from "@/lib/exercise/schemas";

type Ctx = { params: Promise<{ id: string }> };

// Add an exercise (from a template snapshot, or custom). Write: doctor + clinic admin; only while the plan is active.
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  const parsed = itemInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const i = parsed.data;
  const { id } = await params;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (plan.status !== "ACTIVE") throw new HttpError(409, "This plan is closed");
      let data;
      if (i.templateId) {
        const t = await tx.exerciseTemplate.findFirst({ where: { id: i.templateId, tenantId: g.tenantId, deletedAt: null } });
        if (!t) throw new HttpError(404, "Exercise template not found");
        data = snapshotFromTemplate(t, i);
      } else {
        data = { templateId: null, name: i.name!, sets: i.sets ?? null, reps: i.reps ?? null, holdSeconds: i.holdSeconds ?? null, frequency: i.frequency ?? null, instructions: i.instructions ?? null };
      }
      const last = await tx.exercisePlanItem.aggregate({ where: { planId: id }, _max: { sortOrder: true } });
      const row = await tx.exercisePlanItem.create({ data: { ...data, planId: id, sortOrder: (last._max.sortOrder ?? -1) + 1 }, select: { id: true } });
      await audit(tx, g.tenantId, g.session.userId, "CREATE", "ExercisePlanItem", row.id);
      return row;
    }, TX_OPTS);
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Reorder: body { order: [itemId, ...] } must list every item exactly once.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  const parsed = reorderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the full list of exercise ids in the new order" }, { status: 400 });
  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (plan.status !== "ACTIVE") throw new HttpError(409, "This plan is closed");
      const cur = await tx.exercisePlanItem.findMany({ where: { planId: id }, select: { id: true } });
      if (!isValidReorder(cur.map((c) => c.id), parsed.data.order)) throw new HttpError(400, "The order must list every exercise in the plan exactly once");
      for (const [idx, itemId] of parsed.data.order.entries()) await tx.exercisePlanItem.update({ where: { id: itemId }, data: { sortOrder: idx } });
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "ExercisePlan", id);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
