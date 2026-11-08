import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, SETUP_ROLES } from "@/lib/ipd/gate";
import { withBedLocked } from "@/lib/ipd/service";
import { updateBedSchema } from "@/lib/ipd/schemas";

// Clinic admin only. A bed with an admitted patient cannot be switched off. Rate changes affect new stays only (stays keep a snapshot).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd", SETUP_ROLES);
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  const parsed = updateBedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const bed = await withBedLocked(g.tenantId, id, async (tx) => {
      if (parsed.data.isActive === false) {
        const n = await tx.admission.count({ where: { bedId: id, status: "ADMITTED" } });
        if (n > 0) throw new HttpError(409, "A patient is admitted in this bed. Move or discharge them first");
      }
      const { dailyRate, ...rest } = parsed.data;
      const b = await tx.bed.update({
        where: { id }, data: { ...rest, ...(dailyRate !== undefined ? { dailyRate: dailyRate.toFixed(2) } : {}) },
        select: { id: true, label: true, dailyRate: true, isActive: true, wardId: true },
      });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "Bed", entityId: id, diff: parsed.data } });
      return b;
    });
    return NextResponse.json({ bed: { ...bed, dailyRate: Number(bed.dailyRate) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "That ward already has a bed with this label" }, { status: 409 });
    return toErrorResponse(e);
  }
}
