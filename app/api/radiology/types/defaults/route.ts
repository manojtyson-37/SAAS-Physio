import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_CATALOGUE_ROLES, radGate } from "@/lib/radiology/gate";
import { STARTER_TYPES } from "@/lib/radiology/starterTypes";

// Additive and idempotent: study types that already exist (by name) are left untouched.
export async function POST() {
  const g = await radGate(RAD_CATALOGUE_ROLES);
  if (!g.session) return g.response;
  try {
    const r = await prisma.imagingStudyType.createMany({
      data: STARTER_TYPES.map((t) => ({ tenantId: g.tenantId, modality: t.modality, name: t.name, bodyPart: t.bodyPart, price: t.price.toFixed(2) })),
      skipDuplicates: true,
    });
    if (r.count > 0) await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "ImagingStudyType", entityId: "starter-set", diff: { added: r.count } } });
    return NextResponse.json({ added: r.count, total: STARTER_TYPES.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
