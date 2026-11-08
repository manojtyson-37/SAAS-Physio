import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { createInvoiceInTx } from "@/lib/hospital/invoiceTx";
import { getEnabledModules } from "@/lib/modules/guard";
import { audit, lockPlan, TX_OPTS } from "@/lib/dental/db";
import { dentalGate } from "@/lib/dental/gate";

// Bill all DONE, not-yet-billed procedures on one invoice. Billing is operational, so front desk may do it too.
// Items whose earlier invoice was cancelled become billable again. The plan row lock makes double clicks safe.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await dentalGate(["DOCTOR", "CLINIC_ADMIN", "STAFF"]);
  if (!g.session) return g.response;
  const { id } = await params;
  try {
    if (!(await getEnabledModules(g.session)).has("billing")) throw new HttpError(409, "Billing is not enabled for this clinic");
    const out = await prisma.$transaction(async (tx) => {
      const plan = await lockPlan(tx, g.tenantId, id);
      const done = await tx.treatmentPlanItem.findMany({ where: { planId: id, status: "DONE" }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
      const ids = [...new Set(done.map((i) => i.invoiceId).filter((x): x is string => !!x))];
      const cancelled = ids.length ? await tx.invoice.findMany({ where: { id: { in: ids }, tenantId: g.tenantId, status: "CANCELLED" }, select: { id: true } }) : [];
      const dead = new Set(cancelled.map((c) => c.id));
      const items = done.filter((i) => !i.invoiceId || dead.has(i.invoiceId));
      if (items.length === 0) throw new HttpError(409, "Nothing to bill: no completed procedures are waiting for an invoice");
      const inv = await createInvoiceInTx(tx, {
        tenantId: g.tenantId, userId: g.session.userId, patientId: plan.patientId,
        lines: items.map((i) => ({ description: i.tooth ? `${i.procedure} (tooth ${i.tooth})` : i.procedure, qty: 1, unitPrice: Number(i.price), gstPercent: Number(i.gstPercent) })),
        notes: "Dental treatment plan",
      });
      await tx.treatmentPlanItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { invoiceId: inv.id } });
      await audit(tx, g.tenantId, g.session.userId, "UPDATE", "TreatmentPlan", id);
      return { invoiceId: inv.id, number: inv.number, totalPaise: inv.totalPaise, items: items.length };
    }, TX_OPTS);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
