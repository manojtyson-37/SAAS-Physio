import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { audit, requirePatient, TX_OPTS } from "@/lib/dental/db";
import { CLINICAL_WRITERS, dentalGate } from "@/lib/dental/gate";
import { planTotals, PLAN_STATUSES, type PlanStatus } from "@/lib/dental/plan";
import { createPlanSchema } from "@/lib/dental/schemas";

// Read: any clinic user. ?status= ?q= (title/patient) ?patientId=
export async function GET(req: NextRequest) {
  const g = await dentalGate();
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const patientId = sp.get("patientId");
  const plans = await prisma.treatmentPlan.findMany({
    where: {
      tenantId: g.tenantId, deletedAt: null,
      ...(status && (PLAN_STATUSES as string[]).includes(status) ? { status: status as PlanStatus } : {}),
      ...(patientId ? { patientId } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { patient: { name: { contains: q, mode: "insensitive" } } }, { patient: { uhid: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { patient: { select: { id: true, name: true, uhid: true } }, items: { select: { price: true, gstPercent: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return NextResponse.json({
    plans: plans.map((p) => ({
      id: p.id, title: p.title, status: p.status, createdAt: p.createdAt, patient: p.patient,
      itemCount: p.items.filter((i) => i.status !== "CANCELLED").length,
      totals: planTotals(p.items.map((i) => ({ price: Number(i.price), gstPercent: Number(i.gstPercent), status: i.status }))),
    })),
  });
}

// Write: doctor + clinic admin (treatment decisions are clinical).
export async function POST(req: NextRequest) {
  const g = await dentalGate(CLINICAL_WRITERS);
  if (!g.session) return g.response;
  const parsed = createPlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { patientId, title, notes, items } = parsed.data;
  try {
    await requirePatient(g.tenantId, patientId);
    const plan = await prisma.$transaction(async (tx) => {
      const p = await tx.treatmentPlan.create({
        data: {
          tenantId: g.tenantId, patientId, title, notes, createdById: g.session.userId,
          items: { create: items.map((i, idx) => ({ tooth: i.tooth, procedure: i.procedure, price: i.price.toFixed(2), gstPercent: i.gstPercent.toFixed(2), sortOrder: idx })) },
        },
        select: { id: true },
      });
      await audit(tx, g.tenantId, g.session.userId, "CREATE", "TreatmentPlan", p.id);
      return p;
    }, TX_OPTS);
    return NextResponse.json({ ok: true, id: plan.id }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
