import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { platformGate } from "@/lib/platform/gate";
import { generateTempPassword } from "@/lib/platform/password";

// Issues a new temporary password for a clinic user (shown once; the user must change it at next sign-in).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id, userId } = await params;
  const temp = generateTempPassword();
  const hash = await hashPassword(temp);
  const done = await prisma.$transaction(async (tx) => {
    // The owner can reset any active clinic admin. The onboarding team only while the admin has never signed in with their own
    // password (mustChangePassword still true): otherwise this would be a way to take over a live clinic account.
    const r = await tx.user.updateMany({
      where: { id: userId, tenantId: id, role: "CLINIC_ADMIN", deletedAt: null, isActive: true, tenant: { deletedAt: null }, ...(g.owner ? {} : { mustChangePassword: true }) },
      data: { passwordHash: hash, mustChangePassword: true, passwordChangedAt: new Date() },
    });
    if (r.count === 1) await tx.auditLog.create({ data: { tenantId: id, actorId: g.session.userId, action: "RESET", entity: "ClinicAdminPassword", entityId: userId } });
    return r.count;
  });
  if (done !== 1) return NextResponse.json({ error: g.owner ? "Clinic admin not found" : "Clinic admin not found, or they have already set their own password (ask the platform owner)" }, { status: 404 });
  return NextResponse.json({ tempPassword: temp }, { headers: { "Cache-Control": "no-store" } });
}
