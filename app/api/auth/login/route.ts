import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

// bcrypt hash of a random string; only used to equalise timing for unknown addresses.
const DUMMY_HASH = "$2b$10$4eCXQsVtsp6MhVqqrhzKkeJodc7KaasiuRmzKIlc2dRBLpzRzVY8u";

const schema = z.object({
  email: z.string().email().max(120),
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

    // Throttle guessing without letting a stranger lock someone out: 8 failures per 15 minutes from one address for one
    // login, or 40 from anywhere for one login (a distributed attack).
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 45);
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const [byIp, byEmail] = await Promise.all([
      prisma.auditLog.count({ where: { action: "LOGIN_FAILED", entity: "LoginIp", entityId: `${ip}|${email}`, timestamp: { gte: since } } }),
      prisma.auditLog.count({ where: { action: "LOGIN_FAILED", entity: "Login", entityId: email, timestamp: { gte: since } } }),
    ]);
    if (byIp >= 8 || byEmail >= 40) {
      return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    // Always run one bcrypt comparison so an unknown address takes as long as a wrong password.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.isActive || user.deletedAt || !ok) {
      await prisma.auditLog.createMany({ data: [
        { action: "LOGIN_FAILED", entity: "Login", entityId: email },
        { action: "LOGIN_FAILED", entity: "LoginIp", entityId: `${ip}|${email}` },
      ] }).catch(() => {});
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
