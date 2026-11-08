import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(10, "Use at least 10 characters").max(72, "Use at most 72 characters"),
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
  // Guessing the current password through this route is throttled like signing in.
  const since = new Date(Date.now() - 15 * 60 * 1000);
  if ((await prisma.auditLog.count({ where: { action: "PASSWORD_CHANGE_FAILED", entity: "UserPassword", entityId: user.id, timestamp: { gte: since } } })) >= 5) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (!(await verifyPassword(current, user.passwordHash))) {
    await prisma.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, action: "PASSWORD_CHANGE_FAILED", entity: "UserPassword", entityId: user.id } }).catch(() => {});
    return NextResponse.json({ error: "Current password is wrong" }, { status: 400 });
  }
  if (current === next) return NextResponse.json({ error: "Choose a different password" }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false, passwordChangedAt: new Date() } }),
    prisma.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, action: "UPDATE", entity: "UserPassword", entityId: user.id } }),
  ]);
  // Every older session ends with the change; keep this one alive by issuing a fresh cookie.
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, tenantId: true, role: true, name: true } });
  await setSessionCookie({ userId: u.id, tenantId: u.tenantId, role: u.role, name: u.name });
  return NextResponse.json({ ok: true });
}
