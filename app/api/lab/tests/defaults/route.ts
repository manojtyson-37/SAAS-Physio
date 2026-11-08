import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { LAB_CATALOGUE_ROLES, labGate } from "@/lib/lab/gate";
import { STARTER_TESTS } from "@/lib/lab/starterTests";

// Additive and idempotent: tests that already exist (by name, even ones switched off) are left untouched.
export async function POST() {
  const g = await labGate(LAB_CATALOGUE_ROLES);
  if (!g.session) return g.response;
  try {
    const r = await prisma.labTest.createMany({
      data: STARTER_TESTS.map((t) => ({
        tenantId: g.tenantId, name: t.name, category: t.category, sampleType: t.sampleType, unit: t.unit ?? null,
        refLow: t.refLow ?? null, refHigh: t.refHigh ?? null, refText: t.refText ?? null, price: t.price.toFixed(2),
      })),
      skipDuplicates: true,
    });
    if (r.count > 0) await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "LabTest", entityId: "starter-set", diff: { added: r.count } } });
    return NextResponse.json({ added: r.count, total: STARTER_TESTS.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
