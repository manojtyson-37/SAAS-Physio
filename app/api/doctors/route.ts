import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const scope = tenantScope(session);

  const doctors = await prisma.user.findMany({
    where: { ...scope, role: "DOCTOR", isActive: true, deletedAt: null },
    // Whitelist: never return the full User row (it carries passwordHash).
    select: { id: true, name: true, specialty: true, title: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ doctors });
}
