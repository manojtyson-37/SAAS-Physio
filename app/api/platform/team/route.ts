import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { platformGate } from "@/lib/platform/gate";
import { generateTempPassword } from "@/lib/platform/password";

// Owner only: the platform's own logins. The onboarding team shares one ONBOARDING login (or one each, your choice).
export async function GET() {
  const g = await platformGate(true);
  if (!g.session) return g.response;
  const users = await prisma.user.findMany({
    where: { tenantId: null, role: { in: ["SUPER_ADMIN", "ONBOARDING"] }, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ users, me: g.session.userId });
}

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(120) });

export async function POST(req: NextRequest) {
  const g = await platformGate(true);
  if (!g.session) return g.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
  const temp = generateTempPassword();
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { name: parsed.data.name, email, role: "ONBOARDING", tenantId: null, passwordHash: await hashPassword(temp), mustChangePassword: true }, select: { id: true, name: true, email: true } });
    await tx.auditLog.create({ data: { actorId: g.session.userId, action: "CREATE", entity: "PlatformUser", entityId: u.id, diff: { role: "ONBOARDING" } } });
    return u;
  });
  return NextResponse.json({ user, tempPassword: temp }, { status: 201 });
}
