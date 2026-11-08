import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(10, "Use at least 10 characters").max(100),
});

// Any signed-in user. This route deliberately does not use requireSession: it is the one call a user with a
// temporary password (mustChangePassword) is allowed to make.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { current, next } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, passwordHash: true, isActive: true, deletedAt: true, tenantId: true } });
  if (!user || !user.isActive || user.deletedAt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await verifyPassword(current, user.passwordHash))) return NextResponse.json({ error: "Current password is wrong" }, { status: 400 });
  if (current === next) return NextResponse.json({ error: "Choose a different password" }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } }),
    prisma.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, action: "UPDATE", entity: "UserPassword", entityId: user.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
