import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { radGate } from "@/lib/radiology/gate";
import { invoiceMap } from "@/lib/radiology/view";

/** Recent imaging orders with impressions for one patient: feeds PatientImagingPanel. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const g = await radGate();
  if (!g.session) return g.response;
  const { patientId } = await params;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  const rows = await prisma.imagingOrder.findMany({
    where: { tenantId: g.tenantId, patientId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 8,
    select: { id: true, orderNo: true, status: true, studyName: true, modality: true, createdAt: true, reportedAt: true, impression: true, invoiceId: true },
  });
  const inv = await invoiceMap(g.tenantId, rows.map((r) => r.invoiceId));
  return NextResponse.json({ orders: rows.map(({ invoiceId, ...o }) => ({ ...o, invoice: invoiceId ? inv.get(invoiceId) ?? null : null })) });
}
