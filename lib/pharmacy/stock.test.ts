import { describe, expect, it } from "vitest";
import { allocateFefo, expiryStatus, fefoOrder, rxQuantity, stockLevel, StockError } from "./stock";

const b = (id: string, expiryDate: string | null, qtyOnHand: number, salePrice = 2) => ({ id, batchNo: id.toUpperCase(), expiryDate, qtyOnHand, salePrice });
const TODAY = "2026-11-08";

describe("fefo", () => {
  it("orders soonest expiry first, no-expiry last", () => {
    const o = fefoOrder([b("c", null, 1), b("b", "2027-03-01", 1), b("a", "2026-12-01", 1)]);
    expect(o.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("spans batches and takes the oldest first", () => {
    const a = allocateFefo([b("late", "2027-06-01", 10), b("soon", "2026-12-01", 4)], 6, TODAY);
    expect(a).toEqual([
      { batchId: "soon", batchNo: "SOON", qty: 4, unitPrice: 2 },
      { batchId: "late", batchNo: "LATE", qty: 2, unitPrice: 2 },
    ]);
  });
  it("never uses expired or empty batches, but the expiry day itself is valid", () => {
    const a = allocateFefo([b("old", "2026-11-07", 50), b("today", TODAY, 3), b("none", null, 0)], 3, TODAY);
    expect(a).toHaveLength(1);
    expect(a[0].batchId).toBe("today");
  });
  it("refuses when in-date stock cannot cover the request", () => {
    expect(() => allocateFefo([b("old", "2026-01-01", 99), b("ok", "2027-01-01", 2)], 3, TODAY, "Dolo")).toThrow(StockError);
    expect(() => allocateFefo([b("ok", "2027-01-01", 2)], 0, TODAY)).toThrow(StockError);
    expect(() => allocateFefo([b("ok", "2027-01-01", 2)], 1.5, TODAY)).toThrow(StockError);
  });
});

describe("expiry / levels / rx quantity", () => {
  it("classifies expiry", () => {
    expect(expiryStatus(null, TODAY)).toBe("NONE");
    expect(expiryStatus("2026-11-07", TODAY)).toBe("EXPIRED");
    expect(expiryStatus(TODAY, TODAY)).toBe("EXPIRING");
    expect(expiryStatus("2027-02-06", TODAY)).toBe("EXPIRING");
    expect(expiryStatus("2027-02-07", TODAY)).toBe("OK");
  });
  it("classifies stock level", () => {
    expect(stockLevel(0, 5)).toBe("OUT");
    expect(stockLevel(5, 5)).toBe("LOW");
    expect(stockLevel(6, 5)).toBe("OK");
    expect(stockLevel(1, 0)).toBe("OK");
  });
  it("computes quantity from frequency and days", () => {
    expect(rxQuantity("1-0-1", 5)).toBe(10);
    expect(rxQuantity("1-1-1", 7)).toBe(21);
    expect(rxQuantity("0.5-0-0.5", 3)).toBe(3);
    expect(rxQuantity("SOS", 5)).toBeNull();
    expect(rxQuantity("1-0-1", null)).toBeNull();
    expect(rxQuantity("9-9-9", 999)).toBeNull();
  });
});
