import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stockGate } from "@/lib/pharmacy/gate";

/** Prescriptions from the last 14 days that have not been dispensed yet. */
export async function GET() {
  const g = await stockGate("pharmacy", false);
  if (!g.session) return g.response;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await prisma.prescription.findMany({
    where: {
      tenantId: g.tenantId, createdAt: { gte: since }, items: { some: {} },
      dispensations: { none: { status: "COMPLETED" } },
      visit: { deletedAt: null }, patient: { deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, createdAt: true, visitId: true,
      patient: { select: { id: true, name: true, uhid: true } },
      doctor: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  return NextResponse.json({
    queue: rows.map((r) => ({ id: r.id, at: r.createdAt, visitId: r.visitId, patient: r.patient, doctor: r.doctor.name, items: r._count.items })),
  });
}
