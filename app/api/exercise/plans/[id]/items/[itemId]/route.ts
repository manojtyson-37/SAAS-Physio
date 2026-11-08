import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, lockPlan, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PRESCRIBERS } from "@/lib/exercise/gate";
import { updateItemSchema } from "@/lib/exercise/schemas";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

// Edit one exercise of an active plan. Write: doctor + clinic admin.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  const parsed = updateItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, itemId } = await params;
  const d = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (plan.status !== "ACTIVE") throw new HttpError(409, "This plan is closed");
      const r = await tx.exercisePlanItem.updateMany({
        where: { id: itemId, planId: id, deletedAt: null },
        data: {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.sets !== undefined ? { sets: d.sets } : {}), ...(d.reps !== undefined ? { reps: d.reps } : {}), ...(d.holdSeconds !== undefined ? { holdSeconds: d.holdSeconds } : {}),
          ...(d.frequency !== undefined ? { frequency: d.frequency || null } : {}), ...(d.instructions !== undefined ? { instructions: d.instructions || null } : {}),
        },
      });
      if (r.count !== 1) throw new HttpError(404, "Exercise not found");
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "ExercisePlanItem", itemId);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Remove an exercise line from an active plan: a soft delete (the row stays, hidden), and only the clinic admin may revoke.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;
  const { id, itemId } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (plan.status !== "ACTIVE") throw new HttpError(409, "This plan is closed");
      const r = await tx.exercisePlanItem.updateMany({ where: { id: itemId, planId: id, deletedAt: null }, data: { deletedAt: new Date() } });
      if (r.count !== 1) throw new HttpError(404, "Exercise not found");
      await audit(tx, g.tenantId, g.session.userId, "DELETE", "ExercisePlanItem", itemId);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
