import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, WARD_ROLES } from "@/lib/ipd/gate";
import { chartSchema } from "@/lib/ipd/schemas";
import { chartView, CHART_SELECT } from "@/lib/ipd/chart";

// Any clinic user may read the chart.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd");
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  const a = await prisma.admission.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
  if (!a) return NextResponse.json({ error: "Admission not found" }, { status: 404 });
  const rows = await prisma.chartEntry.findMany({ where: { admissionId: id, tenantId: g.tenantId }, orderBy: { recordedAt: "desc" }, select: CHART_SELECT });
  return NextResponse.json({ entries: rows.map(chartView) });
}

// Nurses (STAFF), doctors and admin. Only while the patient is admitted.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd", WARD_ROLES);
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  const parsed = chartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  try {
    const a = await prisma.admission.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: { status: true } });
    if (!a) throw new HttpError(404, "Admission not found");
    if (a.status !== "ADMITTED") throw new HttpError(409, "This admission is closed. Chart entries cannot be added");
    const row = await prisma.chartEntry.create({
      data: {
        tenantId: g.tenantId, admissionId: id, kind: d.kind, recordedAt: d.recordedAt ? new Date(d.recordedAt) : new Date(), recordedById: g.session.userId,
        systolic: d.systolic, diastolic: d.diastolic, pulse: d.pulse, respRate: d.respRate, spo2: d.spo2, gcs: d.gcs,
        intakeMl: d.intakeMl, outputMl: d.outputMl, tempC: d.tempC === undefined ? undefined : d.tempC.toFixed(1), notes: d.notes,
      },
      select: CHART_SELECT,
    });
    await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "ChartEntry", entityId: row.id } });
    return NextResponse.json({ entry: chartView(row) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
