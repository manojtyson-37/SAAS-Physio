import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { prescriptionSchema } from "@/lib/hospital/schemas";
import { isOpen, VisitStatusName } from "@/lib/hospital/visit";

/**
 * Create or replace the visit's prescription (one per visit). Doctor/admin only, and
 * only while the visit is open: a completed visit's prescription is a medico-legal record.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "DOCTOR"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "opd");
  if (off) return off;
  const { id } = await params;

  const parsed = prescriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const visit = await prisma.visit.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null } });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (g.session.role === "DOCTOR" && visit.doctorId !== g.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isOpen(visit.status as VisitStatusName)) {
    return NextResponse.json({ error: "Visit is closed; its prescription can no longer be changed" }, { status: 409 });
  }

  const { items, notes } = parsed.data;
  const prescription = await prisma.$transaction(async (tx) => {
    // Lock the visit row so a concurrent "complete visit" cannot slip in between the check and the write.
    const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS status FROM "Visit" WHERE "id" = ${id} AND "tenantId" = ${g.tenantId} FOR UPDATE`;
    if (!locked[0] || !isOpen(locked[0].status as VisitStatusName)) return null;
    const rx = await tx.prescription.upsert({
      where: { visitId: id },
      create: { tenantId: g.tenantId, visitId: id, patientId: visit.patientId, doctorId: visit.doctorId, notes },
      update: { notes },
    });
    // Replace this prescription's own line items (scoped by prescriptionId) with the submitted list.
    await tx.prescriptionItem.deleteMany({ where: { prescriptionId: rx.id } });
    await tx.prescriptionItem.createMany({
      data: items.map((it, i) => ({ ...it, prescriptionId: rx.id, sortOrder: i })),
    });
    await tx.auditLog.create({
      data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPSERT", entity: "Prescription", entityId: rx.id },
    });
    return tx.prescription.findUniqueOrThrow({ where: { id: rx.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  }, { timeout: 15_000, maxWait: 10_000 });

  if (!prescription) {
    return NextResponse.json({ error: "Visit is closed; its prescription can no longer be changed" }, { status: 409 });
  }
  return NextResponse.json({ prescription });
}
