import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, requirePatient, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PRESCRIBERS } from "@/lib/exercise/gate";
import { progressSummary, snapshotFromTemplate } from "@/lib/exercise/logic";
import { createPlanSchema } from "@/lib/exercise/schemas";

// Read: any clinic user. ?status= ?q= (title/patient/UHID) ?patientId=
export async function GET(req: NextRequest) {
  const g = await exerciseGate();
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const patientId = sp.get("patientId");
  const plans = await prisma.exercisePlan.findMany({
    where: {
      tenantId: g.tenantId, deletedAt: null,
      ...(status === "ACTIVE" || status === "COMPLETED" || status === "CANCELLED" ? { status } : {}),
      ...(patientId ? { patientId } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { patient: { name: { contains: q, mode: "insensitive" } } }, { patient: { uhid: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: {
      patient: { select: { id: true, name: true, uhid: true } },
      doctor: { select: { name: true } },
      _count: { select: { items: true } },
      progress: { select: { recordedAt: true, painScore: true, adherencePercent: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return NextResponse.json({
    plans: plans.map((p) => ({
      id: p.id, title: p.title, status: p.status, startDate: p.startDate, endDate: p.endDate, patient: p.patient, doctor: p.doctor?.name ?? null,
      itemCount: p._count.items, summary: progressSummary(p.progress),
    })),
  });
}

// Write: doctor + clinic admin (prescribing is clinical). Template items are copied, never linked by value.
export async function POST(req: NextRequest) {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  const parsed = createPlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { patientId, title, startDate, endDate, notes, items } = parsed.data;
  try {
    await requirePatient(g.tenantId, patientId);
    if (endDate && startDate && Date.parse(endDate) < Date.parse(startDate)) throw new HttpError(400, "End date cannot be before the start date");
    const plan = await prisma.$transaction(async (tx) => {
      const ids = [...new Set(items.map((i) => i.templateId).filter((x): x is string => !!x))];
      const tpls = ids.length ? await tx.exerciseTemplate.findMany({ where: { id: { in: ids }, tenantId: g.tenantId, deletedAt: null } }) : [];
      const byId = new Map(tpls.map((t) => [t.id, t]));
      const rows = items.map((i, idx) => {
        if (i.templateId) {
          const t = byId.get(i.templateId);
          if (!t) throw new HttpError(404, "Exercise template not found");
          return { ...snapshotFromTemplate(t, i), sortOrder: idx };
        }
        return { templateId: null, name: i.name!, sets: i.sets ?? null, reps: i.reps ?? null, holdSeconds: i.holdSeconds ?? null, frequency: i.frequency ?? null, instructions: i.instructions ?? null, sortOrder: idx };
      });
      const p = await tx.exercisePlan.create({
        data: {
          tenantId: g.tenantId, patientId, title, notes, doctorId: g.session.role === "DOCTOR" ? g.session.userId : null,
          ...(startDate ? { startDate: new Date(startDate) } : {}), endDate: endDate ? new Date(endDate) : null,
          items: { create: rows },
        },
        select: { id: true },
      });
      await audit(tx, g.tenantId, g.session.userId, "CREATE", "ExercisePlan", p.id);
      return p;
    }, TX_OPTS);
    return NextResponse.json({ ok: true, id: plan.id }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
