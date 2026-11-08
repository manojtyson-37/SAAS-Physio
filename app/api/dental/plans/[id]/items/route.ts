import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, lockPlan, TX_OPTS } from "@/lib/dental/db";
import { CLINICAL_WRITERS, dentalGate } from "@/lib/dental/gate";
import { planIsOpen } from "@/lib/dental/plan";
import { addItemSchema } from "@/lib/dental/schemas";

// Add a procedure. Write: doctor + clinic admin. Only while the plan is open.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await dentalGate(CLINICAL_WRITERS);
  if (!g.session) return g.response;
  const parsed = addItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { id } = await params;
  try {
    const item = await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (!planIsOpen(plan.status)) throw new HttpError(409, "This plan is closed; start a new plan for further treatment");
      const last = await tx.treatmentPlanItem.aggregate({ where: { planId: id }, _max: { sortOrder: true } });
      const it = await tx.treatmentPlanItem.create({
        data: { planId: id, tooth: parsed.data.tooth, procedure: parsed.data.procedure, price: parsed.data.price.toFixed(2), gstPercent: parsed.data.gstPercent.toFixed(2), sortOrder: (last._max.sortOrder ?? -1) + 1 },
        select: { id: true },
      });
      await audit(tx, g.tenantId, g.session.userId, "CREATE", "TreatmentPlanItem", it.id);
      return it;
    }, TX_OPTS);
    return NextResponse.json({ ok: true, id: item.id }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
