import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { platformGate } from "@/lib/platform/gate";
import { ageHours, needsPlatform, TICKET_STATUSES } from "@/lib/platform/support";

// Platform owner and onboarding team: the inbox of queries from all clinics (subject, who, how long waiting). No patient data.
export async function GET(req: NextRequest) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const status = req.nextUrl.searchParams.get("status");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (status && status !== "ACTIVE" && !(TICKET_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const rows = await prisma.supportTicket.findMany({
    where: {
      ...(status === "ACTIVE" ? { status: { not: "RESOLVED" as const } } : status ? { status: status as (typeof TICKET_STATUSES)[number] } : {}),
      ...(q ? { OR: [{ subject: { contains: q, mode: "insensitive" as const } }, { tenant: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
    },
    orderBy: [{ urgent: "desc" }, { lastMessageAt: "desc" }],
    take: 200,
    select: { id: true, seq: true, subject: true, category: true, urgent: true, status: true, lastBy: true, lastMessageAt: true, createdAt: true, assignedToId: true, tenant: { select: { id: true, name: true } }, _count: { select: { messages: true } } },
  });
  const now = new Date();
  return NextResponse.json({
    tickets: rows.map((t) => ({
      id: t.id, number: `TKT-${t.seq}`, subject: t.subject, category: t.category, urgent: t.urgent, status: t.status, lastBy: t.lastBy,
      needsUs: needsPlatform(t), waitingHours: ageHours(t.lastMessageAt, now), createdAt: t.createdAt, clinic: t.tenant, messages: t._count.messages, mine: t.assignedToId === g.session.userId,
    })),
  });
}
