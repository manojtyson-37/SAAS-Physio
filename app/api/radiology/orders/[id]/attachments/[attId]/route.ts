import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { radGate } from "@/lib/radiology/gate";

// Revoke a file: soft delete (the file itself is kept in storage and the row stays for the audit trail). Clinic admin only.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; attId: string }> }) {
  const g = await radGate(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;
  const { id, attId } = await params;
  try {
    const n = await prisma.$transaction(async (tx) => {
      const r = await tx.imagingAttachment.updateMany({ where: { id: attId, orderId: id, tenantId: g.tenantId, deletedAt: null }, data: { deletedAt: new Date() } });
      if (r.count === 1) await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "DELETE", entity: "ImagingAttachment", entityId: attId } });
      return r.count;
    });
    if (n !== 1) return NextResponse.json({ error: "File not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
