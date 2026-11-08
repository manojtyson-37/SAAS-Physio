import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, SETUP_ROLES } from "@/lib/ipd/gate";
import { TX } from "@/lib/ipd/service";
import { updateWardSchema } from "@/lib/ipd/schemas";

// Clinic admin only. A ward with an admitted patient cannot be switched off.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd", SETUP_ROLES);
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  const parsed = updateWardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const ward = await prisma.$transaction(async (tx) => {
      // Admit takes a SHARE lock on the ward, so this waits for in-flight admits and then sees them.
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Ward" WHERE id = ${id} AND "tenantId" = ${g.tenantId} FOR UPDATE`;
      if (rows.length === 0) throw new HttpError(404, "Ward not found");
      if (parsed.data.isActive === false) {
        const n = await tx.admission.count({ where: { tenantId: g.tenantId, status: "ADMITTED", bed: { wardId: id } } });
        if (n > 0) throw new HttpError(409, "Patients are admitted in this ward. Discharge or move them first");
      }
      const w = await tx.ward.update({ where: { id }, data: parsed.data, select: { id: true, name: true, type: true, isActive: true } });
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "Ward", entityId: id, diff: parsed.data } });
      return w;
    }, TX);
    return NextResponse.json({ ward });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A ward with that name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}
