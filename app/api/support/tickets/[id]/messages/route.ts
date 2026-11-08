import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { requireTenantSession } from "@/lib/hospital/guard";
import { messageSchema } from "@/lib/platform/support";

// The clinic adds to its own query. A reply on a resolved or waiting query reopens it for the ClinicOS team.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(undefined, { allowWhenReadOnly: true });
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = messageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      const own = await tx.supportTicket.findFirst({ where: { id, tenantId: g.tenantId, ...(g.session.role === "CLINIC_ADMIN" ? {} : { createdById: g.session.userId }) }, select: { id: true } });
      if (!own) throw new HttpError(404, "Query not found");
      await tx.supportMessage.create({ data: { ticketId: id, authorId: g.session.userId, authorName: g.session.name, fromPlatform: false, body: parsed.data.body } });
      await tx.supportTicket.update({ where: { id }, data: { status: "OPEN", lastBy: "CLINIC", lastMessageAt: new Date(), resolvedAt: null } });
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
