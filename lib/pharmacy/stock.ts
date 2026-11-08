/** Pure stock rules (no database): first-expiry-first-out allocation, expiry status, prescription quantities. */

export type BatchLike = { id: string; batchNo: string; expiryDate: string | null; qtyOnHand: number; salePrice: number };
export type Allocation = { batchId: string; batchNo: string; qty: number; unitPrice: number };

export class StockError extends Error {}

/** Sort: soonest expiry first, batches with no expiry last, ties by id so locking order is stable. */
export function fefoOrder<T extends { id: string; expiryDate: string | null }>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) {
      if (a.expiryDate === null) return 1;
      if (b.expiryDate === null) return -1;
      return a.expiryDate < b.expiryDate ? -1 : 1;
    }
    return a.id < b.id ? -1 : 1;
  });
}

/** A batch is dispensable through its expiry day; `today` is the India calendar day (YYYY-MM-DD). */
export const isDispensable = (b: { expiryDate: string | null; qtyOnHand: number }, today: string) =>
  b.qtyOnHand > 0 && (b.expiryDate === null || b.expiryDate >= today);

/** Takes `qty` units from the dispensable batches, soonest expiry first. Throws when stock cannot cover it. */
export function allocateFefo(batches: BatchLike[], qty: number, today: string, label = "item"): Allocation[] {
  if (!Number.isInteger(qty) || qty < 1) throw new StockError("Quantity must be a whole number of at least 1");
  const usable = fefoOrder(batches.filter((b) => isDispensable(b, today)));
  const out: Allocation[] = [];
  let need = qty;
  for (const b of usable) {
    if (need === 0) break;
    const take = Math.min(b.qtyOnHand, need);
    out.push({ batchId: b.id, batchNo: b.batchNo, qty: take, unitPrice: b.salePrice });
    need -= take;
  }
  if (need > 0) {
    const have = qty - need;
    throw new StockError(`Not enough stock for ${label}: ${have} in date, ${qty} needed`);
  }
  return out;
}

export type ExpiryStatus = "EXPIRED" | "EXPIRING" | "OK" | "NONE";

/** EXPIRING = within `warnDays` days (default 90). */
export function expiryStatus(expiryDate: string | null, today: string, warnDays = 90): ExpiryStatus {
  if (!expiryDate) return "NONE";
  if (expiryDate < today) return "EXPIRED";
  const days = (Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= warnDays ? "EXPIRING" : "OK";
}

/**
 * Units a prescription line needs: "1-0-1" for 5 days = 10. Returns null for "SOS"/free text, where the
 * pharmacist decides. Capped so a typo cannot suggest an absurd quantity.
 */
export function rxQuantity(frequency: string | null | undefined, durationDays: number | null | undefined): number | null {
  if (!frequency || !durationDays || durationDays < 1) return null;
  const parts = frequency.trim().split("-");
  if (parts.length < 2 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const perDay = parts.reduce((s, p) => s + Number(p), 0);
  const total = Math.ceil(perDay * durationDays);
  return total >= 1 && total <= 1000 ? total : null;
}

export type StockLevel = "OUT" | "LOW" | "OK";
export const stockLevel = (onHand: number, reorderLevel: number): StockLevel =>
  onHand <= 0 ? "OUT" : reorderLevel > 0 && onHand <= reorderLevel ? "LOW" : "OK";
