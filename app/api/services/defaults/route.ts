import { moduleGate } from "@/lib/modules/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { clinicTypeDef } from "@/lib/modules/clinicTypes";

/**
 * Loads the starter price list for the clinic's type, but only into an empty price list; safe to call twice.
 * Healthcare services by clinical establishments are generally GST-exempt in India, so starter items use 0%;
 * clinics can change this per item (confirm treatment with the clinic's accountant).
 */
export async function POST() {
  const g = await requireTenantSession(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "billing");
  if (off) return off;

  const existing = await prisma.serviceItem.count({ where: { tenantId: g.tenantId } });
  if (existing > 0) {
    return NextResponse.json({ error: "Your price list already has items" }, { status: 409 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: g.tenantId }, select: { clinicType: true } });
  const starter = clinicTypeDef(tenant?.clinicType).starterServices;
  const r = await prisma.serviceItem.createMany({
    data: starter.map((s) => ({ ...s, tenantId: g.tenantId, gstPercent: "0.00" })),
    skipDuplicates: true,
  });
  return NextResponse.json({ created: r.count }, { status: 201 });
}
