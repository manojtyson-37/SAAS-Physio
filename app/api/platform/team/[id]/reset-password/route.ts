import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { platformGate } from "@/lib/platform/gate";
import { generateTempPassword } from "@/lib/platform/password";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await platformGate(true);
  if (!g.session) return g.response;
  const { id } = await params;
  const temp = generateTempPassword();
  const hash = await hashPassword(temp);
  const n = await prisma.$transaction(async (tx) => {
    const r = await tx.user.updateMany({ where: { id, role: "ONBOARDING", tenantId: null, deletedAt: null }, data: { passwordHash: hash, mustChangePassword: true, passwordChangedAt: new Date() } });
    if (r.count === 1) await tx.auditLog.create({ data: { actorId: g.session.userId, action: "RESET", entity: "PlatformUser", entityId: id } });
    return r.count;
  });
  if (n !== 1) return NextResponse.json({ error: "Onboarding login not found" }, { status: 404 });
  return NextResponse.json({ tempPassword: temp }, { headers: { "Cache-Control": "no-store" } });
}
