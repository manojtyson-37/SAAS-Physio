import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { platformGate } from "@/lib/platform/gate";
import { ticketPatchSchema } from "@/lib/platform/support";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true, seq: true, subject: true, category: true, urgent: true, status: true, lastBy: true, createdAt: true, resolvedAt: true, assignedToId: true,
      tenant: { select: { id: true, name: true, clinicType: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, authorName: true, fromPlatform: true, body: true, createdAt: true } },
    },
  });
  if (!t) return NextResponse.json({ error: "Query not found" }, { status: 404 });
  return NextResponse.json({ ticket: { ...t, number: `TKT-${t.seq}`, mine: t.assignedToId === g.session.userId } });
}

// Change status, mark urgent or take it ("assign to me"). Resolving stamps the time; reopening clears it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = ticketPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: parsed.success ? "Nothing to update" : "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const n = await prisma.$transaction(async (tx) => {
    const r = await tx.supportTicket.updateMany({
      where: { id },
      data: {
        ...(d.status ? { status: d.status, resolvedAt: d.status === "RESOLVED" ? new Date() : null } : {}),
        ...(d.urgent !== undefined ? { urgent: d.urgent } : {}),
        ...(d.assignToMe ? { assignedToId: g.session.userId } : {}),
      },
    });
    if (r.count === 1) {
      const t = await tx.supportTicket.findUniqueOrThrow({ where: { id }, select: { tenantId: true } });
      await tx.auditLog.create({ data: { tenantId: t.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "SupportTicket", entityId: id, diff: d } });
    }
    return r.count;
  });
  if (n !== 1) return NextResponse.json({ error: "Query not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
