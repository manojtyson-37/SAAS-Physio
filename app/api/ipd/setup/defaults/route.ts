import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, SETUP_ROLES } from "@/lib/ipd/gate";

const LAYOUT = [
  { name: "General Ward", type: "GENERAL" as const, prefix: "G", count: 6, rate: 800 },
  { name: "Private Ward", type: "PRIVATE" as const, prefix: "P", count: 4, rate: 2500 },
  { name: "ICU", type: "ICU" as const, prefix: "ICU", count: 4, rate: 5000 },
];

// Clinic admin only. Additive and idempotent: creates only wards/beds that are missing, never edits or removes existing ones.
export async function POST() {
  const g = await ipdGate("ipd", SETUP_ROLES);
  if (!g.session) return g.response;
  try {
    let wardsAdded = 0, bedsAdded = 0;
    for (const w of LAYOUT) {
      const made = await prisma.ward.createMany({ data: [{ tenantId: g.tenantId, name: w.name, type: w.type }], skipDuplicates: true });
      wardsAdded += made.count;
      const ward = await prisma.ward.findFirstOrThrow({ where: { tenantId: g.tenantId, name: w.name }, select: { id: true } });
      const beds = await prisma.bed.createMany({
        data: Array.from({ length: w.count }, (_, i) => ({ tenantId: g.tenantId, wardId: ward.id, label: `${w.prefix}-${String(i + 1).padStart(2, "0")}`, dailyRate: w.rate.toFixed(2) })),
        skipDuplicates: true,
      });
      bedsAdded += beds.count;
    }
    await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "IpdDefaults", entityId: g.tenantId, diff: { wardsAdded, bedsAdded } } });
    return NextResponse.json({ wardsAdded, bedsAdded });
  } catch (e) {
    return toErrorResponse(e);
  }
}
