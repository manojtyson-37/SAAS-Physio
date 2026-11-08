import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { platformGate } from "@/lib/platform/gate";
import { applyAction, type SubAction } from "@/lib/platform/subscription";
import { clinicView, TENANT_SELECT } from "@/lib/platform/view";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_trial"), days: z.coerce.number().int().optional() }),
  z.object({ action: z.literal("extend_trial"), days: z.coerce.number().int() }),
  z.object({ action: z.literal("set_plan"), plan: z.string() }),
  z.object({ action: z.literal("activate"), plan: z.string(), paidThrough: z.string().optional().nullable() }),
  z.object({ action: z.literal("suspend"), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("reactivate"), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("cancel"), note: z.string().max(300).optional() }),
]);

// One change at a time per clinic (row lock). Owner-only actions are enforced inside applyAction, not by the UI.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const input = parsed.data;
  let action: SubAction;
  if (input.action === "activate") {
    const pt = input.paidThrough ? new Date(`${input.paidThrough}T23:59:59+05:30`) : null;
    if (pt && Number.isNaN(pt.getTime())) return NextResponse.json({ error: "Paid-through must be a date (YYYY-MM-DD)" }, { status: 400 });
    action = { action: "activate", plan: input.plan, paidThrough: pt };
  } else action = input as SubAction;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Tenant" WHERE id = ${id} AND "deletedAt" IS NULL FOR UPDATE`;
      if (locked.length === 0) throw new HttpError(404, "Clinic not found");
      const cur = await tx.tenant.findUniqueOrThrow({ where: { id }, select: { subscriptionStatus: true, trialEndsAt: true, paidThrough: true, plan: true, trialStartedAt: true } });
      const res = applyAction({ status: cur.subscriptionStatus, trialEndsAt: cur.trialEndsAt, paidThrough: cur.paidThrough, plan: cur.plan, trialStartedAt: cur.trialStartedAt }, action, g.owner);
      if (!res.ok) throw new HttpError(g.owner ? 409 : 403, res.error);
      const t = await tx.tenant.update({ where: { id }, data: res.patch, select: TENANT_SELECT });
      await tx.auditLog.create({ data: { tenantId: id, actorId: g.session.userId, action: input.action.toUpperCase(), entity: "Subscription", entityId: id, diff: { from: cur.subscriptionStatus, patch: JSON.parse(JSON.stringify(res.patch)) } } });
      return t;
    });
    return NextResponse.json({ clinic: clinicView(out) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
