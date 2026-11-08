import { describe, expect, it } from "vitest";
import {
  BillingError,
  checkPayment,
  computeInvoice,
  formatInvoiceNumber,
  paiseToDecimal,
  statusFor,
  toPaise,
} from "./billing";
import { amountInWords } from "./words";
import { isValidDayKey } from "./dates";
import { createInvoiceSchema, paymentSchema, serviceSchema } from "./billingSchemas";

const line = (unitPrice: number, qty = 1, gstPercent = 0) => ({ description: "x", qty, unitPrice, gstPercent });

describe("computeInvoice", () => {
  it("is exact where floating point rupees would drift", () => {
    expect(toPaise(0.1) + toPaise(0.2)).toBe(30);
    const r = computeInvoice([line(0.1), line(0.2)]);
    expect(r.totalPaise).toBe(30);
  });

  it("computes GST per line and sums", () => {
    const r = computeInvoice([line(800, 1, 18), line(500, 2, 0)]);
    expect(r.subtotalPaise).toBe(180000);
    expect(r.gstPaise).toBe(14400);
    expect(r.totalPaise).toBe(194400);
  });

  it("handles fractional GST rates (2.5%)", () => {
    const r = computeInvoice([line(1000, 1, 2.5)]);
    expect(r.gstPaise).toBe(2500);
  });

  it("rounds GST to the nearest paisa", () => {
    // 33.33 * 18% = 5.9994 -> 6.00
    expect(computeInvoice([line(33.33, 1, 18)]).gstPaise).toBe(600);
  });

  it("applies a discount to the grand total", () => {
    const r = computeInvoice([line(1000, 1, 18)], 180);
    expect(r.totalPaise).toBe(100000);
    expect(r.discountPaise).toBe(18000);
  });

  it("rejects a discount equal to or above the invoice amount", () => {
    expect(() => computeInvoice([line(100)], 100)).toThrow(BillingError);
    expect(() => computeInvoice([line(100)], 500)).toThrow(BillingError);
  });

  it("rejects an empty invoice and an oversized total", () => {
    expect(() => computeInvoice([])).toThrow(BillingError);
    expect(() => computeInvoice([line(1_000_000, 1000, 28)])).toThrow(BillingError);
  });

  it("formats decimals for the database", () => {
    expect(paiseToDecimal(194400)).toBe("1944.00");
    expect(paiseToDecimal(5)).toBe("0.05");
  });
});

describe("payments", () => {
  const inv = (paidPaise: number, status = "UNPAID") => ({ status, totalPaise: 100000, paidPaise });

  it("accepts a partial payment and reports PARTIAL", () => {
    const r = checkPayment(inv(0), 40000);
    expect(r).toEqual({ ok: true, newPaidPaise: 40000, status: "PARTIAL" });
  });

  it("settles exactly to PAID", () => {
    const r = checkPayment(inv(40000, "PARTIAL"), 60000);
    expect(r).toEqual({ ok: true, newPaidPaise: 100000, status: "PAID" });
  });

  it("refuses overpayment, zero, paid and cancelled invoices", () => {
    expect(checkPayment(inv(40000, "PARTIAL"), 60001).ok).toBe(false);
    expect(checkPayment(inv(0), 0).ok).toBe(false);
    expect(checkPayment(inv(100000, "PAID"), 100).ok).toBe(false);
    expect(checkPayment(inv(0, "CANCELLED"), 100).ok).toBe(false);
  });

  it("statusFor boundaries", () => {
    expect(statusFor(100, 0)).toBe("UNPAID");
    expect(statusFor(100, 1)).toBe("PARTIAL");
    expect(statusFor(100, 100)).toBe("PAID");
  });
});

describe("invoice number and words", () => {
  it("formats numbers", () => {
    expect(formatInvoiceNumber(7, new Date("2026-11-08"))).toBe("INV-2026-00007");
    expect(formatInvoiceNumber(23, new Date("2026-11-08"))).toBe("INV-2026-00023");
  });

  it("writes amounts in Indian words", () => {
    expect(amountInWords(123450)).toBe("Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only");
    expect(amountInWords(100000)).toBe("Rupees One Thousand Only");
    expect(amountInWords(12_34_567_00)).toBe("Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only");
    expect(amountInWords(2_50_00_000_00)).toBe("Rupees Two Crore Fifty Lakh Only");
    expect(amountInWords(5)).toBe("Rupees Zero and Five Paise Only");
  });
});

describe("schemas", () => {
  it("coerces form strings and defaults GST to 0 and discount to 0", () => {
    const r = createInvoiceSchema.parse({
      patientId: "p1",
      lineItems: [{ description: "Consultation", qty: "1", unitPrice: "800" }],
    });
    expect(r.lineItems[0].gstPercent).toBe(0);
    expect(r.discount).toBe(0);
  });

  it("rejects bad lines", () => {
    const base = { patientId: "p1" };
    expect(createInvoiceSchema.safeParse({ ...base, lineItems: [] }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, lineItems: [{ description: "", qty: 1, unitPrice: 10 }] }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, lineItems: [{ description: "a", qty: 0, unitPrice: 10 }] }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, lineItems: [{ description: "a", qty: 1, unitPrice: -5 }] }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, lineItems: [{ description: "a", qty: 1, unitPrice: 5, gstPercent: 99 }] }).success).toBe(false);
  });

  it("validates payments and services", () => {
    expect(paymentSchema.safeParse({ method: "Bitcoin", amount: 5 }).success).toBe(false);
    expect(paymentSchema.safeParse({ method: "UPI", amount: 0 }).success).toBe(false);
    expect(paymentSchema.safeParse({ method: "UPI", amount: "250.50", reference: "T123" }).success).toBe(true);
    expect(serviceSchema.safeParse({ name: "Consultation", price: 500 }).success).toBe(true);
    expect(serviceSchema.safeParse({ name: "", price: 500 }).success).toBe(false);
  });
});

describe("day keys", () => {
  it("accepts real days and rejects impossible ones", () => {
    expect(isValidDayKey("2026-11-08")).toBe(true);
    expect(isValidDayKey("2028-02-29")).toBe(true);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("2026-13-45")).toBe(false);
    expect(isValidDayKey("nope")).toBe(false);
  });
});

describe("computeInvoice line order (pharmacy pairs dispensation lines with invoice lines by index)", () => {
  it("keeps input order", () => {
    const c = computeInvoice([
      { description: "a", qty: 1, unitPrice: 10, gstPercent: 0 },
      { description: "b", qty: 2, unitPrice: 5, gstPercent: 12 },
      { description: "c", qty: 3, unitPrice: 1, gstPercent: 5 },
    ]);
    expect(c.lines.map((l) => l.description)).toEqual(["a", "b", "c"]);
  });
});
