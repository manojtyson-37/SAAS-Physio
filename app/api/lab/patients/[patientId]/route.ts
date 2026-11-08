import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { labGate } from "@/lib/lab/gate";
import { invoiceMap } from "@/lib/lab/view";

/** Recent lab orders plus per-test numeric history (oldest to newest) for one patient: feeds PatientLabPanel. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const g = await labGate();
  if (!g.session) return g.response;
  const { patientId } = await params;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: g.tenantId, deletedAt: null }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const orders = await prisma.labOrder.findMany({
    where: { tenantId: g.tenantId, patientId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 8,
    select: { id: true, orderNo: true, status: true, createdAt: true, invoiceId: true, items: { select: { testName: true, flag: true, resultValue: true } } },
  });
  const inv = await invoiceMap(g.tenantId, orders.map((o) => o.invoiceId));
  const points = await prisma.labOrderItem.findMany({
    where: { order: { tenantId: g.tenantId, patientId, deletedAt: null, status: { not: "CANCELLED" } }, resultNumeric: { not: null } },
    orderBy: { resultedAt: "desc" }, take: 120,
    select: { testName: true, unit: true, refLow: true, refHigh: true, resultNumeric: true, flag: true, resultedAt: true },
  });
  const byTest = new Map<string, { testName: string; unit: string | null; refLow: number | null; refHigh: number | null; history: { value: number; flag: string | null; at: Date | null }[] }>();
  for (const p of points) {
    const t = byTest.get(p.testName) ?? { testName: p.testName, unit: p.unit, refLow: p.refLow == null ? null : Number(p.refLow), refHigh: p.refHigh == null ? null : Number(p.refHigh), history: [] };
    if (t.history.length < 8) t.history.unshift({ value: Number(p.resultNumeric), flag: p.flag, at: p.resultedAt });
    byTest.set(p.testName, t);
  }
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id, orderNo: o.orderNo, status: o.status, createdAt: o.createdAt, tests: o.items.length,
      abnormal: o.items.filter((i) => i.flag && i.flag !== "NORMAL").length, invoice: o.invoiceId ? inv.get(o.invoiceId) ?? null : null,
    })),
    trends: [...byTest.values()].slice(0, 12),
  });
}
