import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { CLINIC_TYPE_KEYS, CLINIC_TYPES, type ClinicTypeKey } from "@/lib/modules/clinicTypes";
import { platformGate } from "@/lib/platform/gate";
import { generateTempPassword } from "@/lib/platform/password";
import { addDays, DEFAULT_TRIAL_DAYS, isPlan, MAX_TRIAL_DAYS } from "@/lib/platform/subscription";
import { clinicView, TENANT_SELECT } from "@/lib/platform/view";
import { toErrorResponse } from "@/lib/hospital/http";

export async function GET() {
  const g = await platformGate();
  if (!g.session) return g.response;
  const rows = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { ...TENANT_SELECT, _count: { select: { patients: { where: { deletedAt: null } }, users: { where: { deletedAt: null } } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ clinics: rows.map((r) => ({ ...clinicView(r), patientCount: r._count.patients, userCount: r._count.users })), owner: g.owner });
}

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  clinicType: z.enum(CLINIC_TYPE_KEYS as [ClinicTypeKey, ...ClinicTypeKey[]]),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().email().max(120),
  trialDays: z.coerce.number().int().min(1).max(MAX_TRIAL_DAYS).default(DEFAULT_TRIAL_DAYS),
  plan: z.string().optional(),
});

// Onboarding and owner. Creates the clinic on a trial, with its module preset, and its first admin with a temporary password
// that is returned once in this response (the admin must change it at first sign-in).
export async function POST(req: NextRequest) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  if (d.plan && !isPlan(d.plan)) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const adminEmail = d.adminEmail.toLowerCase();
  try {
    if (await prisma.user.findFirst({ where: { email: { equals: adminEmail, mode: "insensitive" } }, select: { id: true } })) {
      return NextResponse.json({ error: "That admin email is already in use" }, { status: 409 });
    }
    const temp = generateTempPassword();
    const preset = CLINIC_TYPES[d.clinicType];
    const now = new Date();
    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: d.name, clinicType: d.clinicType, facilityType: preset.facility, phone: d.phone || null, email: d.email || null, address: d.address || null, gstNumber: d.gstNumber || null,
          enabledModules: [...preset.defaultModules], selfServiceModules: false,
          subscriptionStatus: "TRIAL", trialStartedAt: now, trialEndsAt: addDays(now, d.trialDays), plan: d.plan ?? null,
          users: { create: { name: d.adminName, email: adminEmail, passwordHash: await hashPassword(temp), role: "CLINIC_ADMIN", mustChangePassword: true } },
        },
        select: { id: true, name: true },
      });
      await tx.auditLog.create({ data: { tenantId: t.id, actorId: g.session.userId, action: "CREATE", entity: "Clinic", entityId: t.id, diff: { clinicType: d.clinicType, trialDays: d.trialDays } } });
      return t;
    });
    return NextResponse.json({ clinic: tenant, admin: { name: d.adminName, email: adminEmail }, tempPassword: temp }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
