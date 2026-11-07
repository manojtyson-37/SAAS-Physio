import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { updateVisitSchema } from "@/lib/hospital/schemas";
import { canTransition, VisitStatusName } from "@/lib/hospital/visit";

const num = (d: unknown) => (d === null || d === undefined ? null : Number(d));

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession();
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "opd");
  if (off) return off;
  const { id } = await params;

  const visit = await prisma.visit.findFirst({
    where: { id, tenantId: g.tenantId, deletedAt: null },
    include: {
      patient: true,
      doctor: { select: { id: true, name: true, specialty: true, title: true } },
      vitals: { orderBy: { recordedAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
      prescription: { include: { items: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (g.session.role === "DOCTOR" && visit.doctorId !== g.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    visit: {
      ...visit,
      vitals: visit.vitals.map((v) => ({
        ...v,
        tempC: num(v.tempC),
        weightKg: num(v.weightKg),
        heightCm: num(v.heightCm),
        bmi: num(v.bmi),
      })),
    },
  });
}

/** Status moves and consultation fields. Clinical fields (diagnosis, advice, follow-up) are doctor/admin only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "STAFF", "DOCTOR"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "opd");
  if (off) return off;
  const { id } = await params;

  const parsed = updateVisitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { status, ...fields } = parsed.data;

  const visit = await prisma.visit.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null } });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isClinician = g.session.role === "DOCTOR" || g.session.role === "CLINIC_ADMIN";
  if (g.session.role === "DOCTOR" && visit.doctorId !== g.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const touchesClinical = fields.diagnosis !== undefined || fields.advice !== undefined || fields.followUpDate !== undefined;
  if (touchesClinical && !isClinician) {
    return NextResponse.json({ error: "Only a doctor can record diagnosis or advice" }, { status: 403 });
  }
  if (status && (status === "IN_CONSULT" || status === "COMPLETED") && !isClinician) {
    return NextResponse.json({ error: "Only a doctor can start or complete a consultation" }, { status: 403 });
  }
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    return NextResponse.json({ error: `Visit is ${visit.status.toLowerCase()} and can no longer be edited` }, { status: 409 });
  }
  if (status && !canTransition(visit.status as VisitStatusName, status)) {
    return NextResponse.json({ error: `Cannot move a ${visit.status} visit to ${status}` }, { status: 409 });
  }

  // Compare-and-set: the write only applies if the status is still what we validated against,
  // so two simultaneous requests cannot both make the same transition.
  const { count } = await prisma.visit.updateMany({
    where: { id, tenantId: g.tenantId, status: visit.status, deletedAt: null },
    data: {
      ...fields,
      ...(status ? { status } : {}),
      ...(status === "IN_CONSULT" ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETED" || status === "CANCELLED" ? { endedAt: new Date() } : {}),
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Visit was changed by someone else; reload and try again" }, { status: 409 });
  }
  const updated = await prisma.visit.findUniqueOrThrow({ where: { id } });
  await prisma.auditLog.create({
    data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "Visit", entityId: id },
  });
  return NextResponse.json({ visit: updated });
}
