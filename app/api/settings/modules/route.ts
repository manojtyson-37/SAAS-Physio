import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { CLINIC_TYPES, CLINIC_TYPE_KEYS, clinicTypeDef, isClinicType } from "@/lib/modules/clinicTypes";
import { MODULES, PLANNED_MODULES } from "@/lib/modules/registry";
import { parseSelection, resolveModules } from "@/lib/modules/resolve";

/** Clinic admin view of which modules are on, plus what exists and what is coming. */
export async function GET() {
  const g = await requireTenantSession(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;

  const t = await prisma.tenant.findUnique({
    where: { id: g.tenantId },
    select: { clinicType: true, enabledModules: true },
  });
  const type = clinicTypeDef(t?.clinicType);
  return NextResponse.json({
    clinicType: type.key,
    clinicTypeLabel: type.label,
    enabled: [...resolveModules(t?.enabledModules)],
    modules: MODULES.map(({ key, label, description, group }) => ({ key, label, description, group })),
    planned: PLANNED_MODULES,
    types: CLINIC_TYPE_KEYS.map((k) => ({
      key: k,
      label: CLINIC_TYPES[k].label,
      blurb: CLINIC_TYPES[k].blurb,
      defaultModules: CLINIC_TYPES[k].defaultModules,
    })),
  });
}

/**
 * Update the clinic's modules and/or type. Switching a module off hides it; it never deletes any data,
 * so switching it back on restores everything.
 */
export async function PUT(req: NextRequest) {
  const g = await requireTenantSession(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;

  const body = (await req.json().catch(() => null)) as { modules?: unknown; clinicType?: unknown; applyPreset?: unknown } | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: { enabledModules?: string[]; clinicType?: (typeof CLINIC_TYPE_KEYS)[number]; facilityType?: "CLINIC" | "HOSPITAL" } = {};

  if (body.clinicType !== undefined) {
    if (typeof body.clinicType !== "string" || !isClinicType(body.clinicType)) {
      return NextResponse.json({ error: "Unknown clinic type" }, { status: 400 });
    }
    data.clinicType = body.clinicType;
    data.facilityType = CLINIC_TYPES[body.clinicType].facility;
    if (body.applyPreset === true) data.enabledModules = [...CLINIC_TYPES[body.clinicType].defaultModules];
  }

  if (body.modules !== undefined) {
    const sel = parseSelection(body.modules);
    if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: 400 });
    data.enabledModules = sel.modules;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const [updated] = await prisma.$transaction([
    prisma.tenant.update({ where: { id: g.tenantId }, data, select: { clinicType: true, enabledModules: true } }),
    prisma.auditLog.create({
      data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "TenantModules", entityId: g.tenantId },
    }),
  ]);
  return NextResponse.json({ clinicType: updated.clinicType, enabled: [...resolveModules(updated.enabledModules)] });
}
