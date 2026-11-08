import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { moduleGate } from "@/lib/modules/guard";
import { ipdGate, WARD_ROLES } from "@/lib/ipd/gate";
import { billAdmission } from "@/lib/ipd/service";

// Invoice the bed charges of a discharged admission that was not billed at discharge. Needs the billing module.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd", WARD_ROLES);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "billing");
  if (off) return off;
  const { id } = await ctx.params;
  try {
    const r = await billAdmission({ tenantId: g.tenantId, userId: g.session.userId, admissionId: id });
    return NextResponse.json({ invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, total: r.totalPaise / 100 }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
