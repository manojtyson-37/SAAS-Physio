import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(undefined, { allowWhenReadOnly: true });
  if (!g.session) return g.response;
  const { id } = await params;
  const t = await prisma.supportTicket.findFirst({
    where: { id, tenantId: g.tenantId, ...(g.session.role === "CLINIC_ADMIN" ? {} : { createdById: g.session.userId }) },
    select: {
      id: true, seq: true, subject: true, category: true, urgent: true, status: true, lastBy: true, createdAt: true, resolvedAt: true,
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, authorName: true, fromPlatform: true, body: true, createdAt: true } },
    },
  });
  if (!t) return NextResponse.json({ error: "Query not found" }, { status: 404 });
  return NextResponse.json({ ticket: { ...t, number: `TKT-${t.seq}` } });
}
