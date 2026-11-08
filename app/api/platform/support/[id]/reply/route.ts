import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { platformGate } from "@/lib/platform/gate";
import { platformReplySchema } from "@/lib/platform/support";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = platformReplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const status = parsed.data.status ?? "WAITING_CLINIC";
  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.findUnique({ where: { id }, select: { tenantId: true } });
      if (!t) throw new HttpError(404, "Query not found");
      await tx.supportMessage.create({ data: { ticketId: id, authorId: g.session.userId, authorName: `${g.session.name} (ClinicOS)`, fromPlatform: true, body: parsed.data.body } });
      await tx.supportTicket.update({ where: { id }, data: { status, lastBy: "PLATFORM", lastMessageAt: new Date(), resolvedAt: status === "RESOLVED" ? new Date() : null, assignedToId: g.session.userId } });
      await tx.auditLog.create({ data: { tenantId: t.tenantId, actorId: g.session.userId, action: "REPLY", entity: "SupportTicket", entityId: id, diff: { status } } });
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
