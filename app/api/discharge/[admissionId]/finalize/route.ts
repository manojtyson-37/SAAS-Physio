import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { canFinalize } from "@/lib/discharge/rules";
import { ipdGate, SUMMARY_ROLES } from "@/lib/ipd/gate";

// Doctors and clinic admin. DRAFT -> FINAL by compare-and-set; after that the summary is read-only.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ admissionId: string }> }) {
  const g = await ipdGate("discharge", SUMMARY_ROLES);
  if (!g.session) return g.response;
  const { admissionId } = await ctx.params;
  try {
    const a = await prisma.admission.findFirst({ where: { id: admissionId, tenantId: g.tenantId, deletedAt: null }, select: { status: true } });
    if (!a) throw new HttpError(404, "Admission not found");
    const s = await prisma.dischargeSummary.findFirst({ where: { admissionId, tenantId: g.tenantId }, select: { status: true, diagnosis: true } });
    const ok = canFinalize(a.status, s?.status ?? null, s?.diagnosis ?? null);
    if (!ok.ok) throw new HttpError(ok.status, ok.error);
    const now = new Date();
    const r = await prisma.dischargeSummary.updateMany({ where: { admissionId, tenantId: g.tenantId, status: "DRAFT", diagnosis: { not: null } }, data: { status: "FINAL", finalizedAt: now, finalizedById: g.session.userId } });
    if (r.count === 0) throw new HttpError(409, "This summary is already final");
    await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "FINALIZE", entity: "DischargeSummary", entityId: admissionId } });
    return NextResponse.json({ status: "FINAL", finalizedAt: now });
  } catch (e) {
    return toErrorResponse(e);
  }
}
