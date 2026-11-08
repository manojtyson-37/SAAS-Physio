import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { platformGate } from "@/lib/platform/gate";
import { clinicView, TENANT_SELECT } from "@/lib/platform/view";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const t = await prisma.tenant.findFirst({ where: { id, deletedAt: null }, select: TENANT_SELECT });
  if (!t) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  const [admins, history, patientCount, userCount] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: id, role: "CLINIC_ADMIN", deletedAt: null }, select: { id: true, name: true, email: true, isActive: true, mustChangePassword: true }, orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({
      where: { tenantId: id, entity: { in: ["Clinic", "Subscription", "ClinicModules", "ClinicAdminPassword"] } },
      orderBy: { timestamp: "desc" }, take: 30,
      select: { id: true, action: true, entity: true, diff: true, timestamp: true, actor: { select: { name: true, role: true } } },
    }),
    prisma.patient.count({ where: { tenantId: id, deletedAt: null } }),
    prisma.user.count({ where: { tenantId: id, deletedAt: null } }),
  ]);
  return NextResponse.json({
    clinic: clinicView(t), admins, owner: g.owner, patientCount, userCount,
    history: history.map((h) => ({ id: h.id, at: h.timestamp, entity: h.entity, action: h.action, detail: h.diff, by: h.actor ? `${h.actor.name} (${h.actor.role === "SUPER_ADMIN" ? "owner" : "onboarding"})` : null })),
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullish(),
  email: z.string().trim().email().max(120).nullish().or(z.literal("")),
  address: z.string().trim().max(300).nullish(),
  gstNumber: z.string().trim().max(20).nullish(),
});

// Basic clinic details (the clinic type and modules have their own routes).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: parsed.success ? "Nothing to update" : parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const data = { ...parsed.data, ...(parsed.data.email !== undefined ? { email: parsed.data.email || null } : {}) };
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.tenant.updateMany({ where: { id, deletedAt: null }, data });
    if (u.count === 1) await tx.auditLog.create({ data: { tenantId: id, actorId: g.session.userId, action: "UPDATE", entity: "Clinic", entityId: id, diff: { fields: Object.keys(parsed.data) } } });
    return u.count;
  });
  if (r !== 1) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
