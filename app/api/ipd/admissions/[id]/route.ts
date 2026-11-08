import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toPaise } from "@/lib/hospital/billing";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { getEnabledModules } from "@/lib/modules/guard";
import { bedCharges } from "@/lib/ipd/billing";
import { ipdGate, WARD_ROLES } from "@/lib/ipd/gate";
import { updateAdmissionSchema } from "@/lib/ipd/schemas";
import { admissionSelect, admissionView } from "@/lib/ipd/view";

// Any clinic user may view. Includes the stays, a live bed-charge preview and (when billing is on) the invoice.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd");
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  const a = await prisma.admission.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: admissionSelect });
  if (!a) return NextResponse.json({ error: "Admission not found" }, { status: 404 });
  const now = new Date();
  const mods = await getEnabledModules(g.session);
  const stays = await prisma.bedStay.findMany({ where: { admissionId: id, tenantId: g.tenantId }, orderBy: { startedAt: "asc" }, include: { bed: { select: { label: true, ward: { select: { name: true } } } } } });
  const charges = bedCharges(stays.map((s) => ({ startedAt: s.startedAt, endedAt: s.endedAt, ratePaise: toPaise(Number(s.rate)), label: `${s.bed.ward.name} / ${s.bed.label}` })), now);
  const invoice = mods.has("billing") && a.invoiceId
    ? await prisma.invoice.findFirst({ where: { id: a.invoiceId, tenantId: g.tenantId }, select: { id: true, number: true, status: true, total: true } })
    : null;
  const summary = mods.has("discharge")
    ? await prisma.dischargeSummary.findFirst({ where: { admissionId: id, tenantId: g.tenantId }, select: { id: true, status: true } })
    : null;
  return NextResponse.json({
    admission: admissionView(a, now),
    stays: stays.map((s) => ({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, rate: Number(s.rate), bed: `${s.bed.ward.name} / ${s.bed.label}` })),
    charges: { lines: charges.lines.map((l) => ({ label: l.label, days: l.days, rate: l.ratePaise / 100, amount: l.amountPaise / 100 })), total: charges.totalPaise / 100 },
    billingOn: mods.has("billing"),
    invoice: invoice ? { id: invoice.id, number: invoice.number, status: invoice.status, total: Number(invoice.total) } : null,
    summary,
  });
}

// Edit while admitted: ward staff, doctors and admin.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd", WARD_ROLES);
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  const parsed = updateAdmissionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  try {
    if (d.doctorId) {
      const doc = await prisma.user.findFirst({ where: { id: d.doctorId, tenantId: g.tenantId, role: "DOCTOR", isActive: true, deletedAt: null }, select: { id: true } });
      if (!doc) throw new HttpError(400, "Choose an active doctor of this clinic");
    }
    // Compare-and-set on status so an edit cannot land after a discharge.
    const r = await prisma.admission.updateMany({
      where: { id, tenantId: g.tenantId, status: "ADMITTED", deletedAt: null },
      data: {
        ...(d.diagnosis !== undefined ? { diagnosis: d.diagnosis || null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        ...(d.reason !== undefined ? { reason: d.reason || null } : {}),
        ...(d.expectedDischargeAt !== undefined ? { expectedDischargeAt: d.expectedDischargeAt ? new Date(d.expectedDischargeAt) : null } : {}),
        ...(d.doctorId ? { doctorId: d.doctorId } : {}),
      },
    });
    if (r.count === 0) {
      const exists = await prisma.admission.findFirst({ where: { id, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
      throw new HttpError(exists ? 409 : 404, exists ? "This admission is closed and can no longer be edited" : "Admission not found");
    }
    await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "Admission", entityId: id, diff: { fields: Object.keys(d) } } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
