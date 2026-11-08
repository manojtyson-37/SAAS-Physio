import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, lockPlan, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PROGRESS_LOGGERS } from "@/lib/exercise/gate";
import { progressSummary } from "@/lib/exercise/logic";
import { progressSchema, updateProgressSchema } from "@/lib/exercise/schemas";

type Ctx = { params: Promise<{ id: string }> };

const view = (p: { id: string; recordedAt: Date; painScore: number | null; adherencePercent: number | null; notes: string | null }) => ({
  id: p.id, recordedAt: p.recordedAt, painScore: p.painScore, adherencePercent: p.adherencePercent, notes: p.notes,
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const plan = await prisma.exercisePlan.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
  if (!plan) return NextResponse.json({ error: "Exercise plan not found" }, { status: 404 });
  const rows = await prisma.exerciseProgress.findMany({ where: { planId: id, tenantId: g.tenantId }, orderBy: [{ recordedAt: "asc" }, { id: "asc" }] });
  return NextResponse.json({ progress: rows.map(view), summary: progressSummary(rows) });
}

// Log a check-in (pain 0-10, adherence 0-100, notes). Operational, so front desk may log too. Active plans only. No deletes.
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(PROGRESS_LOGGERS);
  if (!g.session) return g.response;
  const parsed = progressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { id } = await params;
  const d = parsed.data;
  try {
    const row = await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (plan.status !== "ACTIVE") throw new HttpError(409, "Progress can only be logged on an active plan");
      const r = await tx.exerciseProgress.create({
        data: { tenantId: g.tenantId, planId: id, patientId: plan.patientId, recordedById: g.session.userId, painScore: d.painScore ?? null, adherencePercent: d.adherencePercent ?? null, notes: d.notes, ...(d.recordedAt ? { recordedAt: new Date(d.recordedAt) } : {}) },
      });
      await audit(tx, g.tenantId, g.session.userId, "CREATE", "ExerciseProgress", r.id);
      return r;
    }, TX_OPTS);
    return NextResponse.json({ progress: view(row) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Correct an entry: body { progressId, painScore?, adherencePercent?, notes? }. Allowed on active and completed plans.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await exerciseGate(PROGRESS_LOGGERS);
  if (!g.session) return g.response;
  const parsed = updateProgressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { progressId, ...rest } = parsed.data;
  if (Object.keys(rest).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      if (plan.status === "CANCELLED") throw new HttpError(409, "This plan was cancelled");
      const r = await tx.exerciseProgress.updateMany({
        where: { id: progressId, planId: id, tenantId: g.tenantId },
        data: {
          ...(rest.painScore !== undefined ? { painScore: rest.painScore } : {}),
          ...(rest.adherencePercent !== undefined ? { adherencePercent: rest.adherencePercent } : {}),
          ...(rest.notes !== undefined ? { notes: rest.notes || null } : {}),
        },
      });
      if (r.count !== 1) throw new HttpError(404, "Entry not found");
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "ExerciseProgress", progressId);
    }, TX_OPTS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
