import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { newTicketSchema, TICKET_STATUSES } from "@/lib/platform/support";
import { toErrorResponse } from "@/lib/hospital/http";

// Every clinic role can raise a query and keep using this when the subscription has ended (that is when they need us most).
// The clinic admin sees all of the clinic's queries; everyone else sees only their own.
export async function GET(req: NextRequest) {
  const g = await requireTenantSession(undefined, { allowWhenReadOnly: true });
  if (!g.session) return g.response;
  const status = req.nextUrl.searchParams.get("status");
  if (status && !(TICKET_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const rows = await prisma.supportTicket.findMany({
    where: { tenantId: g.tenantId, ...(g.session.role === "CLINIC_ADMIN" ? {} : { createdById: g.session.userId }), ...(status ? { status: status as (typeof TICKET_STATUSES)[number] } : {}) },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: { id: true, seq: true, subject: true, category: true, urgent: true, status: true, lastBy: true, lastMessageAt: true, createdAt: true, _count: { select: { messages: true } } },
  });
  return NextResponse.json({ tickets: rows.map((t) => ({ ...t, number: `TKT-${t.seq}`, messages: t._count.messages, _count: undefined })) });
}

export async function POST(req: NextRequest) {
  const g = await requireTenantSession(undefined, { allowWhenReadOnly: true });
  if (!g.session) return g.response;
  const parsed = newTicketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  try {
    // Light flood guard: a clinic user can open at most 10 queries per hour.
    const recent = await prisma.supportTicket.count({ where: { tenantId: g.tenantId, createdById: g.session.userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recent >= 10) return NextResponse.json({ error: "You have raised several queries in the last hour. Please add to an existing one." }, { status: 429 });
    const t = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          tenantId: g.tenantId, createdById: g.session.userId, subject: d.subject, category: d.category, urgent: d.urgent,
          messages: { create: { authorId: g.session.userId, authorName: g.session.name, fromPlatform: false, body: d.body } },
        },
        select: { id: true, seq: true },
      });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "SupportTicket", entityId: ticket.id } });
      return ticket;
    });
    return NextResponse.json({ ticket: { id: t.id, number: `TKT-${t.seq}` } }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
