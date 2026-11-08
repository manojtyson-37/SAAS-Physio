import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stockGate } from "@/lib/pharmacy/gate";
import { stockLabel } from "@/lib/pharmacy/view";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await stockGate("pharmacy", false);
  if (!g.session) return g.response;
  const { id } = await params;
  const d = await prisma.dispensation.findFirst({
    where: { id, tenantId: g.tenantId },
    include: {
      patient: { select: { id: true, name: true, uhid: true, phone: true } },
      invoice: { select: { id: true, number: true, status: true } },
      dispensedBy: { select: { name: true } },
      lines: { include: { item: true, batch: { select: { batchNo: true, expiryDate: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!d) return NextResponse.json({ error: "Dispensation not found" }, { status: 404 });
  return NextResponse.json({
    dispensation: {
      id: d.id, status: d.status, voidReason: d.voidReason, total: Number(d.total), at: d.createdAt, notes: d.notes,
      patient: d.patient, invoice: d.invoice, by: d.dispensedBy?.name ?? null, prescriptionId: d.prescriptionId,
      lines: [...d.lines].sort((a, b) => (a.batch.expiryDate?.getTime() ?? Infinity) - (b.batch.expiryDate?.getTime() ?? Infinity)).map((l) => ({
        id: l.id, label: stockLabel(l.item), unit: l.item.unit, batchNo: l.batch.batchNo, expiry: l.batch.expiryDate?.toISOString().slice(0, 10) ?? null,
        qty: l.qty, unitPrice: Number(l.unitPrice), gstPercent: Number(l.gstPercent), lineTotal: Number(l.lineTotal),
      })),
    },
  });
}
