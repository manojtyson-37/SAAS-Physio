import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, lockPlan, planView, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PRESCRIBERS } from "@/lib/exercise/gate";
import { canMoveTo } from "@/lib/exercise/logic";
import { updatePlanSchema } from "@/lib/exercise/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate();
  if (!g.session) return g.response;
  try {
    return NextResponse.json({ plan: await planView(g.tenantId, (await params).id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Edit title/notes/end date, or close the plan (ACTIVE -> COMPLETED | CANCELLED). Write: doctor + clinic admin.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  const parsed = updatePlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id } = await params;
  const { title, notes, endDate, status } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (plan.status !== "ACTIVE") throw new HttpError(409, "This plan is closed and cannot be changed");
      if (status && !canMoveTo(plan.status, status)) throw new HttpError(409, "Invalid status change");
      if (endDate) {
        const cur = await tx.exercisePlan.findUnique({ where: { id }, select: { startDate: true } });
        if (cur && Date.parse(endDate) < cur.startDate.getTime() - 86_400_000) throw new HttpError(400, "End date cannot be before the start date");
      }
      await tx.exercisePlan.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}), ...(notes !== undefined ? { notes: notes || null } : {}),
          ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
          ...(status ? { status, ...(status === "COMPLETED" && endDate === undefined ? { endDate: new Date() } : {}) } : {}),
        },
      });
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "ExercisePlan", id);
    }, TX_OPTS);
    return NextResponse.json({ plan: await planView(g.tenantId, id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
