import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  const live = await prisma.user.findUnique({ where: { id: session.userId }, select: { isActive: true, deletedAt: true, mustChangePassword: true } });
  if (!live || !live.isActive || live.deletedAt) return NextResponse.json({ user: null });

  const tenant = session.tenantId
    ? await prisma.tenant.findUnique({ where: { id: session.tenantId } })
    : null;

  return NextResponse.json({
    user: {
      id: session.userId,
      name: session.name,
      role: session.role,
      tenantId: session.tenantId,
      tenantName: tenant?.name ?? null,
    },
  });
}
