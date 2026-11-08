import { prisma } from "@/lib/db";
import { expiryStatus, stockLevel } from "./stock";

export const dayOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export const stockLabel = (i: { name: string; strength?: string | null; form?: string | null }) =>
  [i.name, i.strength, i.form].filter(Boolean).join(" ");

type BatchRow = { id: string; batchNo: string; expiryDate: Date | null; qtyOnHand: number; salePrice: unknown; costPrice?: unknown };
type ItemRow = { id: string; name: string; brand: string | null; form: string | null; strength: string | null; unit: string; category: string; hsn: string | null; gstPercent: unknown; reorderLevel: number; isActive: boolean };

/** One stock item with its totals. `inDate` excludes expired batches; that is what can actually be dispensed. */
export function itemView(item: ItemRow, batches: BatchRow[], today: string) {
  const live = batches.filter((b) => b.qtyOnHand > 0);
  const onHand = live.reduce((s, b) => s + b.qtyOnHand, 0);
  const inDate = live.filter((b) => !b.expiryDate || dayOf(b.expiryDate)! >= today);
  const inDateQty = inDate.reduce((s, b) => s + b.qtyOnHand, 0);
  const dated = inDate.filter((b) => b.expiryDate).sort((a, b) => dayOf(a.expiryDate)!.localeCompare(dayOf(b.expiryDate)!));
  const soonest = dated[0];
  const expiredQty = live.filter((b) => b.expiryDate && dayOf(b.expiryDate)! < today).reduce((s, b) => s + b.qtyOnHand, 0);
  const nextBatch = soonest ?? inDate[0];
  return {
    id: item.id, name: item.name, brand: item.brand, form: item.form, strength: item.strength, unit: item.unit,
    category: item.category, hsn: item.hsn, gstPercent: Number(item.gstPercent), reorderLevel: item.reorderLevel, isActive: item.isActive,
    label: stockLabel(item),
    onHand, inDateQty, expiredQty,
    level: stockLevel(inDateQty, item.reorderLevel),
    nextExpiry: dayOf(soonest?.expiryDate),
    nextExpiryStatus: expiryStatus(dayOf(soonest?.expiryDate), today),
    price: nextBatch ? Number(nextBatch.salePrice) : null,
  };
}

/** Counts for the dashboard and the top of the inventory page. */
export async function stockAlerts(tenantId: string, today: string) {
  const items = await prisma.stockItem.findMany({
    where: { tenantId, deletedAt: null, isActive: true },
    select: { id: true, reorderLevel: true, batches: { where: { deletedAt: null, qtyOnHand: { gt: 0 } }, select: { qtyOnHand: true, expiryDate: true } } },
  });
  let lowStock = 0, outOfStock = 0, expiringBatches = 0, expiredBatches = 0;
  for (const it of items) {
    const inDateQty = it.batches.filter((b) => !b.expiryDate || dayOf(b.expiryDate)! >= today).reduce((s, b) => s + b.qtyOnHand, 0);
    const lvl = stockLevel(inDateQty, it.reorderLevel);
    if (lvl === "LOW") lowStock++;
    if (lvl === "OUT") outOfStock++;
    for (const b of it.batches) {
      const st = expiryStatus(dayOf(b.expiryDate), today);
      if (st === "EXPIRING") expiringBatches++;
      if (st === "EXPIRED") expiredBatches++;
    }
  }
  return { items: items.length, lowStock, outOfStock, expiringBatches, expiredBatches };
}
