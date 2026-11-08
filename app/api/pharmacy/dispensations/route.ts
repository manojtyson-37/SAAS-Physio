import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isValidDayKey, istDayRange } from "@/lib/hospital/dates";
import { stockGate } from "@/lib/pharmacy/gate";

export async function GET(req: NextRequest) {
  const g = await stockGate("pharmacy", false);
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const where: Prisma.DispensationWhereInput = { tenantId: g.tenantId };
  const patientId = sp.get("patientId");
  if (patientId) where.patientId = patientId;
  const from = sp.get("from"), to = sp.get("to");
  if ((from && !isValidDayKey(from)) || (to && !isValidDayKey(to))) return NextResponse.json({ error: "Dates must be YYYY-MM-DD" }, { status: 400 });
  if (from || to) where.createdAt = { ...(from ? { gte: istDayRange(from).start } : {}), ...(to ? { lt: istDayRange(to).end } : {}) };
  const rows = await prisma.dispensation.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    select: {
      id: true, status: true, total: true, createdAt: true, prescriptionId: true,
      patient: { select: { id: true, name: true, uhid: true } },
      invoice: { select: { id: true, number: true, status: true } },
      dispensedBy: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });
  return NextResponse.json({
    dispensations: rows.map((d) => ({
      id: d.id, status: d.status, total: Number(d.total), at: d.createdAt, fromPrescription: !!d.prescriptionId, items: d._count.lines,
      patient: d.patient, invoice: d.invoice, by: d.dispensedBy?.name ?? null,
    })),
  });
}
