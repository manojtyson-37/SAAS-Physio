import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { platformGate } from "@/lib/platform/gate";

const schema = z.object({ name: z.string().trim().min(2).max(100).optional(), isActive: z.boolean().optional() });

// Owner only. Only onboarding logins can be changed here; the owner cannot lock themself out.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await platformGate(true);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: parsed.success ? "Nothing to update" : "Invalid input" }, { status: 400 });
  if (id === g.session.userId) return NextResponse.json({ error: "You cannot change your own login here" }, { status: 409 });
  const n = await prisma.$transaction(async (tx) => {
    const r = await tx.user.updateMany({ where: { id, role: "ONBOARDING", tenantId: null, deletedAt: null }, data: parsed.data });
    if (r.count === 1) await tx.auditLog.create({ data: { actorId: g.session.userId, action: "UPDATE", entity: "PlatformUser", entityId: id, diff: parsed.data } });
    return r.count;
  });
  if (n !== 1) return NextResponse.json({ error: "Onboarding login not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
