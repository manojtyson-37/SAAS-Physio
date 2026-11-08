import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { audit, lockPlan, planView, TX_OPTS } from "@/lib/dental/db";
import { CLINICAL_WRITERS, dentalGate } from "@/lib/dental/gate";
import { transitionBlocker } from "@/lib/dental/plan";
import { updatePlanSchema } from "@/lib/dental/schemas";
import { HttpError } from "@/lib/hospital/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await dentalGate();
  if (!g.session) return g.response;
  try {
    return NextResponse.json({ plan: await planView(g.tenantId, (await params).id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Write: doctor + clinic admin. Status moves follow the transition table in lib/dental/plan.ts.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await dentalGate(CLINICAL_WRITERS);
  if (!g.session) return g.response;
  const parsed = updatePlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id } = await params;
  const { status, title, notes } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if ((title !== undefined || notes !== undefined) && (plan.status === "COMPLETED" || plan.status === "CANCELLED")) {
        throw new HttpError(409, "A closed plan cannot be edited");
      }
      if (status && status !== plan.status) {
        const items = await tx.treatmentPlanItem.findMany({ where: { planId: id }, select: { status: true } });
        const blocker = transitionBlocker(plan.status, status, items);
        if (blocker) throw new HttpError(409, blocker);
      } else if (status && status === plan.status) {
        throw new HttpError(409, "The plan is already in that status");
      }
      await tx.treatmentPlan.update({ where: { id }, data: { ...(title !== undefined ? { title } : {}), ...(notes !== undefined ? { notes: notes || null } : {}), ...(status ? { status } : {}) } });
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "TreatmentPlan", id);
    }, TX_OPTS);
    return NextResponse.json({ plan: await planView(g.tenantId, id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
