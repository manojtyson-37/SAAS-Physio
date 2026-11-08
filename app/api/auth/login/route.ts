import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

// bcrypt hash of a random string; only used to equalise timing for unknown addresses.
const DUMMY_HASH = "$2b$10$4eCXQsVtsp6MhVqqrhzKkeJodc7KaasiuRmzKIlc2dRBLpzRzVY8u";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    // Throttle guessing: after 10 failed attempts for an address in 15 minutes, refuse (also protects the platform logins).
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const failures = await prisma.auditLog.count({ where: { action: "LOGIN_FAILED", entity: "Login", entityId: email, timestamp: { gte: since } } });
    if (failures >= 10) {
      return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    // Always run one bcrypt comparison so an unknown address takes as long as a wrong password.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.isActive || user.deletedAt || !ok) {
      await prisma.auditLog.create({ data: { action: "LOGIN_FAILED", entity: "Login", entityId: email.slice(0, 200) } }).catch(() => {});
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (user.role === "SUPER_ADMIN" || user.role === "ONBOARDING") {
      await prisma.auditLog.create({ data: { actorId: user.id, action: "LOGIN", entity: "PlatformUser", entityId: user.id } }).catch(() => {});
    }

    await setSessionCookie({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId },
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/auth/login]", message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
