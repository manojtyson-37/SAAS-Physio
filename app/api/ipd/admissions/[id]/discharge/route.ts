import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { getEnabledModules } from "@/lib/modules/guard";
import { ipdGate, WARD_ROLES } from "@/lib/ipd/gate";
import { dischargePatient } from "@/lib/ipd/service";

// Ward staff, doctors and admin (front desk closes the bill after the doctor's order).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd", WARD_ROLES);
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  try {
    const mods = await getEnabledModules(g.session);
    const r = await dischargePatient({ tenantId: g.tenantId, userId: g.session.userId, admissionId: id, billingOn: mods.has("billing"), dischargeOn: mods.has("discharge") });
    return NextResponse.json({
      id: r.id, dischargedAt: r.dischargedAt, bedCharges: r.bedChargesPaise / 100, invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber,
      lines: r.lines.map((l) => ({ label: l.label, days: l.days, rate: l.ratePaise / 100, amount: l.amountPaise / 100 })),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
