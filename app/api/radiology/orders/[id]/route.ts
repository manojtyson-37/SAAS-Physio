import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_WORK_ROLES, radGate } from "@/lib/radiology/gate";
import { updateImagingOrderSchema } from "@/lib/radiology/schemas";
import { loadImagingOrder } from "@/lib/radiology/view";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await radGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const order = await loadImagingOrder(g.tenantId, id);
  if (!order) return NextResponse.json({ error: "Imaging order not found" }, { status: 404 });
  return NextResponse.json({ order });
}

// Edit the clinical information (the study on an issued order is fixed: cancel and re-order instead).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await radGate(RAD_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = updateImagingOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const n = await prisma.$transaction(async (tx) => {
      const r = await tx.imagingOrder.updateMany({ where: { id, tenantId: g.tenantId, deletedAt: null, status: { not: "CANCELLED" } }, data: { clinicalInfo: parsed.data.clinicalInfo || null } });
      if (r.count === 1) await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "ImagingOrder", entityId: id } });
      return r.count;
    });
    if (n !== 1) return NextResponse.json({ error: "Imaging order not found or cancelled" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
