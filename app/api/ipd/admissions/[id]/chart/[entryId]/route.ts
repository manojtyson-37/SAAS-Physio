import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, WARD_ROLES } from "@/lib/ipd/gate";
import { updateChartSchema } from "@/lib/ipd/schemas";
import { chartView, CHART_SELECT } from "@/lib/ipd/chart";

// Nurses (STAFF), doctors and admin. Entries are edited in place (no deletes) and only while the patient is admitted.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; entryId: string }> }) {
  const g = await ipdGate("ipd", WARD_ROLES);
  if (!g.session) return g.response;
  const { id, entryId } = await ctx.params;
  const parsed = updateChartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { tempC, recordedAt, notes, ...rest } = parsed.data;
  try {
    const row = await prisma.$transaction(async (tx) => {
      const a = await tx.$queryRaw<{ status: string }[]>`SELECT status::text AS status FROM "Admission" WHERE id = ${id} AND "tenantId" = ${g.tenantId} AND "deletedAt" IS NULL FOR SHARE`;
      if (a.length === 0) throw new HttpError(404, "Admission not found");
      if (a[0].status !== "ADMITTED") throw new HttpError(409, "This admission is closed. Chart entries can no longer be edited");
      const r = await tx.chartEntry.updateMany({
        where: { id: entryId, admissionId: id, tenantId: g.tenantId },
        data: {
          ...rest,
          ...(recordedAt ? { recordedAt: new Date(recordedAt) } : {}),
          ...(tempC !== undefined ? { tempC: tempC === null ? null : tempC.toFixed(1) } : {}),
          ...(notes !== undefined ? { notes: notes || null } : {}),
        },
      });
      if (r.count === 0) throw new HttpError(404, "Chart entry not found");
      await tx.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "ChartEntry", entityId: entryId } });
      return tx.chartEntry.findFirstOrThrow({ where: { id: entryId }, select: CHART_SELECT });
    });
    return NextResponse.json({ entry: chartView(row) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
