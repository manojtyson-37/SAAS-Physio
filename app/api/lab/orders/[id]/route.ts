import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { LAB_WORK_ROLES, labGate } from "@/lib/lab/gate";
import { updateLabOrderSchema } from "@/lib/lab/schemas";
import { loadLabOrder } from "@/lib/lab/view";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await labGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const order = await loadLabOrder(g.tenantId, id);
  if (!order) return NextResponse.json({ error: "Lab order not found" }, { status: 404 });
  return NextResponse.json({ order });
}

// Edit the clinical notes (tests on an issued order are fixed: cancel and re-order instead).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await labGate(LAB_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = updateLabOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const done = await prisma.$transaction(async (tx) => {
      const r = await tx.labOrder.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null, status: { not: "CANCELLED" } }, data: { clinicalNotes: parsed.data.clinicalNotes || null } });
      if (r.count === 1) await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "LabOrder", entityId: id } });
      return r.count;
    });
    if (done !== 1) return NextResponse.json({ error: "Lab order not found or cancelled" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
