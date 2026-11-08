import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { istDateKey } from "@/lib/hospital/dates";
import { stockGate } from "@/lib/pharmacy/gate";
import { rxQuantity } from "@/lib/pharmacy/stock";
import { itemView } from "@/lib/pharmacy/view";

/** A prescription with, for each medicine, the stock items that match it and a suggested quantity. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await stockGate("pharmacy", false);
  if (!g.session) return g.response;
  const { id } = await params;
  const today = istDateKey();
  const rx = await prisma.prescription.findFirst({
    where: { id, tenantId: g.tenantId },
    select: {
      id: true, visitId: true, notes: true, createdAt: true,
      patient: { select: { id: true, name: true, uhid: true, allergies: true } },
      doctor: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" } },
      dispensations: { where: { status: "COMPLETED" }, select: { id: true } },
    },
  });
  if (!rx) return NextResponse.json({ error: "Prescription not found" }, { status: 404 });

  const stock = (
    await prisma.stockItem.findMany({
      where: { tenantId: g.tenantId, deletedAt: null, isActive: true },
      take: 1000,
      include: { batches: { where: { deletedAt: null, qtyOnHand: { gt: 0 } }, select: { id: true, batchNo: true, expiryDate: true, qtyOnHand: true, salePrice: true } } },
    })
  ).map((i) => itemView(i, i.batches, today));

  const compact = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, "");
  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return NextResponse.json({
    prescription: {
      id: rx.id, visitId: rx.visitId, at: rx.createdAt, doctor: rx.doctor.name, patient: rx.patient, alreadyDispensed: rx.dispensations.length > 0,
      items: rx.items.map((it) => {
        const generic = norm(it.genericName), brand = norm(it.brandName), strength = compact(it.strength);
        // Strict on purpose: same generic name (or same brand) and, when the prescription states one, the same strength.
        // A near match (a combination product, another strength) is never offered, because dispensing the wrong drug is the worst failure here.
        const matches = stock
          .filter((s) => (norm(s.name) === generic || (brand && norm(s.brand) === brand)) && (!strength || compact(s.strength) === strength))
          .sort((a, b) => b.inDateQty - a.inDateQty)
          .slice(0, 6);
        return {
          id: it.id, genericName: it.genericName, brandName: it.brandName, form: it.form, strength: it.strength, dose: it.dose,
          frequency: it.frequency, durationDays: it.durationDays, instructions: it.instructions,
          suggestedQty: rxQuantity(it.frequency, it.durationDays), matches,
        };
      }),
    },
  });
}
