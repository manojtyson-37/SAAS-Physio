import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { audit, requirePatient } from "@/lib/dental/db";
import { CLINICAL_WRITERS, dentalGate } from "@/lib/dental/gate";
import { currentState } from "@/lib/dental/fdi";
import { toothRecordSchema } from "@/lib/dental/schemas";

type Ctx = { params: Promise<{ patientId: string }> };

const view = (r: { id: string; tooth: number; condition: string; surfaces: string | null; notes: string | null; createdAt: Date; recordedById: string | null }, names: Map<string, string>) => ({
  id: r.id, tooth: r.tooth, condition: r.condition, surfaces: r.surfaces, notes: r.notes, at: r.createdAt, by: r.recordedById ? names.get(r.recordedById) ?? null : null,
});

// Read: any clinic user.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await dentalGate();
  if (!g.session) return g.response;
  try {
    const { patientId } = await params;
    const patient = await requirePatient(g.tenantId, patientId);
    const rows = await prisma.toothRecord.findMany({ where: { tenantId: g.tenantId, patientId, deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    const users = await prisma.user.findMany({ where: { tenantId: g.tenantId, id: { in: [...new Set(rows.map((r) => r.recordedById).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    const state = currentState(rows);
    return NextResponse.json({
      patient,
      teeth: [...state.values()].sort((a, b) => a.tooth - b.tooth).map((r) => view(r, names)),
      history: rows.slice(0, 200).map((r) => view(r, names)),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Write: doctor + clinic admin (clinical content).
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await dentalGate(CLINICAL_WRITERS);
  if (!g.session) return g.response;
  const parsed = toothRecordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const { patientId } = await params;
    await requirePatient(g.tenantId, patientId);
    const rec = await prisma.$transaction(async (tx) => {
      const r = await tx.toothRecord.create({ data: { tenantId: g.tenantId, patientId, recordedById: g.session.userId, ...parsed.data } });
      await audit(tx, g.tenantId, g.session.userId, "CREATE", "ToothRecord", r.id);
      return r;
    });
    return NextResponse.json({ ok: true, id: rec.id }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// Undo a finding: soft delete (?recordId=). The previous finding becomes current again.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const g = await dentalGate(CLINICAL_WRITERS);
  if (!g.session) return g.response;
  const recordId = req.nextUrl.searchParams.get("recordId");
  if (!recordId) return NextResponse.json({ error: "recordId is required" }, { status: 400 });
  try {
    const { patientId } = await params;
    const done = await prisma.$transaction(async (tx) => {
      const r = await tx.toothRecord.updateMany({ where: { id: recordId, patientId, tenantId: g.tenantId, deletedAt: null }, data: { deletedAt: new Date() } });
      if (r.count === 1) await audit(tx, g.tenantId, g.session.userId, "DELETE", "ToothRecord", recordId);
      return r.count;
    });
    if (done !== 1) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
