import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { vitalsSchema } from "@/lib/hospital/schemas";
import { calcBmi } from "@/lib/hospital/vitals";
import { isOpen, VisitStatusName } from "@/lib/hospital/visit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "STAFF", "DOCTOR"]);
  if (!g.session) return g.response;
  const { id } = await params;

  const parsed = vitalsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const v = parsed.data;

  const visit = await prisma.visit.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null } });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (g.session.role === "DOCTOR" && visit.doctorId !== g.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isOpen(visit.status as VisitStatusName)) {
    return NextResponse.json({ error: "Visit is closed" }, { status: 409 });
  }

  const vitals = await prisma.vitals.create({
    data: {
      ...v,
      bmi: calcBmi(v.weightKg, v.heightCm),
      tenantId: g.tenantId,
      visitId: id,
      patientId: visit.patientId,
      recordedById: g.session.userId,
    },
  });
  await prisma.auditLog.create({
    data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "Vitals", entityId: vitals.id },
  });
  return NextResponse.json({ vitals: { ...vitals, tempC: v.tempC ?? null, weightKg: v.weightKg ?? null, heightCm: v.heightCm ?? null, bmi: calcBmi(v.weightKg, v.heightCm) } }, { status: 201 });
}
