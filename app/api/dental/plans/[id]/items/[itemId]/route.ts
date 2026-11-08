import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, lockPlan, TX_OPTS } from "@/lib/dental/db";
import { CLINICAL_WRITERS, dentalGate } from "@/lib/dental/gate";
import { canMarkDone, planIsOpen } from "@/lib/dental/plan";
import { updateItemSchema } from "@/lib/dental/schemas";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

// Edit a planned procedure, or mark it done (sets doneAt; moves an accepted plan to in-progress). DONE items are immutable.
// Write: doctor + clinic admin.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await dentalGate(CLINICAL_WRITERS);
  if (!g.session) return g.response;
  const parsed = updateItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, itemId } = await params;
  const { status, price, gstPercent, ...rest } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      const item = await tx.treatmentPlanItem.findFirst({ where: { id: itemId, planId: id } });
      if (!item) throw new HttpError(404, "Procedure not found");
      if (item.status === "DONE") throw new HttpError(409, "A completed procedure cannot be changed");
      if (item.status === "CANCELLED") throw new HttpError(409, "This procedure was removed");
      if (!planIsOpen(plan.status)) throw new HttpError(409, "This plan is closed");
      if (status === "DONE" && !canMarkDone(plan.status)) throw new HttpError(409, "Mark the plan accepted before recording completed procedures");
      await tx.treatmentPlanItem.update({
        where: { id: itemId },
        data: {
          ...rest,
          ...(price !== undefined ? { price: price.toFixed(2) } : {}),
          ...(gstPercent !== undefined ? { gstPercent: gstPercent.toFixed(2) } : {}),
          ...(status === "DONE" ? { status: "DONE", doneAt: new Date() } : {}),
        },
      });
      if (status === "DONE" && plan.status === "ACCEPTED") await tx.treatmentPlan.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "TreatmentPlanItem", itemId);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Remove a planned procedure (kept as CANCELLED so history is not lost). Done procedures cannot be removed.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await dentalGate(CLINICAL_WRITERS);
  if (!g.session) return g.response;
  const { id, itemId } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (!planIsOpen(plan.status)) throw new HttpError(409, "This plan is closed");
      const r = await tx.treatmentPlanItem.updateMany({ where: { id: itemId, planId: id, status: "PLANNED" }, data: { status: "CANCELLED" } });
      if (r.count !== 1) throw new HttpError(409, "Only planned procedures can be removed");
      await audit(tx, g.tenantId, g.session.userId, "DELETE", "TreatmentPlanItem", itemId);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
