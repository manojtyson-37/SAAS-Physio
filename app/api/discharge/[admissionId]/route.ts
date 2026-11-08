import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { getEnabledModules } from "@/lib/modules/guard";
import { loadPrefill, SUMMARY_SELECT, summaryView } from "@/lib/discharge/service";
import { canEditSummary } from "@/lib/discharge/rules";
import { summarySchema } from "@/lib/discharge/schemas";
import { ipdGate, SUMMARY_ROLES } from "@/lib/ipd/gate";

const admissionSel = {
  id: true, admissionNo: true, status: true, admittedAt: true, dischargedAt: true, diagnosis: true, reason: true, patientId: true,
  patient: { select: { id: true, name: true, uhid: true, phone: true, gender: true, dob: true, address: true, allergies: true, bloodGroup: true } },
  doctor: { select: { id: true, name: true, title: true, specialty: true } },
  bed: { select: { label: true, ward: { select: { name: true } } } },
} as const;

// Any clinic user may read: summary (or null) plus the prefill built from the stay record.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ admissionId: string }> }) {
  const g = await ipdGate("discharge");
  if (!g.session) return g.response;
  const { admissionId } = await ctx.params;
  const a = await prisma.admission.findFirst({ where: { id: admissionId, tenantId: g.tenantId, deletedAt: null }, select: admissionSel });
  if (!a) return NextResponse.json({ error: "Admission not found" }, { status: 404 });
  const mods = await getEnabledModules(g.session);
  const [summary, prefill, tenant] = await Promise.all([
    prisma.dischargeSummary.findFirst({ where: { admissionId, tenantId: g.tenantId }, select: SUMMARY_SELECT }),
    loadPrefill(g.tenantId, a, mods),
    prisma.tenant.findUnique({ where: { id: g.tenantId }, select: { name: true, address: true, phone: true, email: true } }),
  ]);
  return NextResponse.json({
    clinic: tenant,
    admission: { ...a, bed: a.bed ? `${a.bed.ward.name} / ${a.bed.label}` : null, dob: a.patient.dob },
    summary: summary ? summaryView(summary) : null,
    prefill,
    sources: { lab: mods.has("lab"), radiology: mods.has("radiology") },
  });
}

// Doctors and clinic admin. Creates the draft if missing. Only a DRAFT of a discharged patient can change (compare-and-set on status).
export async function PUT(req: NextRequest, ctx: { params: Promise<{ admissionId: string }> }) {
  const g = await ipdGate("discharge", SUMMARY_ROLES);
  if (!g.session) return g.response;
  const { admissionId } = await ctx.params;
  const parsed = summarySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  try {
    const a = await prisma.admission.findFirst({ where: { id: admissionId, tenantId: g.tenantId, deletedAt: null }, select: { status: true, patientId: true, doctorId: true, diagnosis: true } });
    if (!a) throw new HttpError(404, "Admission not found");
    const existing = await prisma.dischargeSummary.findFirst({ where: { admissionId, tenantId: g.tenantId }, select: { status: true } });
    const ok = canEditSummary(a.status, existing?.status ?? null);
    if (!ok.ok) throw new HttpError(ok.status, ok.error);
    if (d.doctorId) {
      const doc = await prisma.user.findFirst({ where: { id: d.doctorId, tenantId: g.tenantId, role: "DOCTOR", isActive: true, deletedAt: null }, select: { id: true } });
      if (!doc) throw new HttpError(400, "Choose an active doctor of this clinic");
    }
    const fields = {
      ...(d.diagnosis !== undefined ? { diagnosis: d.diagnosis || null } : {}),
      ...(d.courseInHospital !== undefined ? { courseInHospital: d.courseInHospital || null } : {}),
      ...(d.proceduresDone !== undefined ? { proceduresDone: d.proceduresDone || null } : {}),
      ...(d.investigationsSummary !== undefined ? { investigationsSummary: d.investigationsSummary || null } : {}),
      ...(d.conditionAtDischarge !== undefined ? { conditionAtDischarge: d.conditionAtDischarge || null } : {}),
      ...(d.medicationsOnDischarge !== undefined ? { medicationsOnDischarge: d.medicationsOnDischarge || null } : {}),
      ...(d.adviceFollowUp !== undefined ? { adviceFollowUp: d.adviceFollowUp || null } : {}),
      ...(d.followUpDate !== undefined ? { followUpDate: d.followUpDate ? new Date(`${d.followUpDate}T00:00:00Z`) : null } : {}),
      ...(d.doctorId ? { doctorId: d.doctorId } : {}),
    };
    if (!existing) {
      try {
        await prisma.dischargeSummary.create({ data: { tenantId: g.tenantId, admissionId, patientId: a.patientId, doctorId: d.doctorId ?? a.doctorId, status: "DRAFT", diagnosis: a.diagnosis, ...fields } });
      } catch (e) {
        // A parallel request created it first: fall through to the guarded update below.
        if (!(typeof e === "object" && e && "code" in e && e.code === "P2002")) throw e;
        const r = await prisma.dischargeSummary.updateMany({ where: { admissionId, tenantId: g.tenantId, status: "DRAFT" }, data: fields });
        if (r.count === 0) throw new HttpError(409, "This summary is final and can no longer be edited");
      }
    } else {
      const r = await prisma.dischargeSummary.updateMany({ where: { admissionId, tenantId: g.tenantId, status: "DRAFT" }, data: fields });
      if (r.count === 0) throw new HttpError(409, "This summary is final and can no longer be edited");
    }
    await prisma.auditLog.create({ data: { tenantId: g.tenantId, actorId: g.session.userId, action: "UPDATE", entity: "DischargeSummary", entityId: admissionId, diff: { fields: Object.keys(d) } } });
    const summary = await prisma.dischargeSummary.findFirstOrThrow({ where: { admissionId, tenantId: g.tenantId }, select: SUMMARY_SELECT });
    return NextResponse.json({ summary: summaryView(summary) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
