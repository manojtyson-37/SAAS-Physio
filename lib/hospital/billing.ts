/**
 * Billing maths. All arithmetic is done in integer paise so totals never drift
 * (floating point rupees would: 0.1 + 0.2 !== 0.3).
 */

export const MAX_TOTAL_PAISE = 99_999_999_00; // fits Decimal(10,2)

export type LineInput = { description: string; qty: number; unitPrice: number; gstPercent: number };

export type ComputedLine = LineInput & {
  basePaise: number;
  gstPaise: number;
  lineTotalPaise: number;
};

export type ComputedInvoice = {
  lines: ComputedLine[];
  subtotalPaise: number;
  gstPaise: number;
  discountPaise: number;
  totalPaise: number;
};

export const toPaise = (rupees: number) => Math.round(rupees * 100);

/** "1234.50" for a paise integer; safe to hand to Prisma Decimal. */
export const paiseToDecimal = (paise: number) => (paise / 100).toFixed(2);

export class BillingError extends Error {}

export function computeInvoice(lines: LineInput[], discount = 0): ComputedInvoice {
  if (lines.length === 0) throw new BillingError("At least one line item is required");

  const computed = lines.map((l) => {
    const basePaise = l.qty * toPaise(l.unitPrice);
    // gstPercent may have 2 decimals (e.g. 2.5): work in basis points to stay integral.
    const gstPaise = Math.round((basePaise * Math.round(l.gstPercent * 100)) / 10_000);
    return { ...l, basePaise, gstPaise, lineTotalPaise: basePaise + gstPaise };
  });

  const subtotalPaise = computed.reduce((s, l) => s + l.basePaise, 0);
  const gstPaise = computed.reduce((s, l) => s + l.gstPaise, 0);
  const discountPaise = toPaise(discount);
  const gross = subtotalPaise + gstPaise;

  if (discountPaise < 0) throw new BillingError("Discount cannot be negative");
  if (discountPaise >= gross) throw new BillingError("Discount must be less than the invoice amount");
  const totalPaise = gross - discountPaise;
  if (totalPaise > MAX_TOTAL_PAISE) throw new BillingError("Invoice amount is too large");

  return { lines: computed, subtotalPaise, gstPaise, discountPaise, totalPaise };
}

export type PayableStatus = "PAID" | "PARTIAL" | "UNPAID";

export function statusFor(totalPaise: number, paidPaise: number): PayableStatus {
  if (paidPaise >= totalPaise) return "PAID";
  return paidPaise > 0 ? "PARTIAL" : "UNPAID";
}

export type PaymentCheck =
  | { ok: true; newPaidPaise: number; status: PayableStatus }
  | { ok: false; error: string };

/** Validates a payment against the current invoice state. Never allows overpayment. */
export function checkPayment(
  invoice: { status: string; totalPaise: number; paidPaise: number },
  amountPaise: number
): PaymentCheck {
  if (invoice.status === "CANCELLED") return { ok: false, error: "Invoice is cancelled" };
  if (amountPaise <= 0) return { ok: false, error: "Amount must be greater than zero" };
  const balance = invoice.totalPaise - invoice.paidPaise;
  if (balance <= 0) return { ok: false, error: "Invoice is already fully paid" };
  if (amountPaise > balance) {
    return { ok: false, error: `Amount exceeds the balance due (₹${paiseToDecimal(balance)})` };
  }
  const newPaidPaise = invoice.paidPaise + amountPaise;
  return { ok: true, newPaidPaise, status: statusFor(invoice.totalPaise, newPaidPaise) };
}

/** Invoice number: INV-<year>-<5 digit running sequence>. The sequence never resets, so numbers stay unique and gap free. */
export function formatInvoiceNumber(seq: number, date = new Date()) {
  return `INV-${date.getFullYear()}-${String(seq).padStart(5, "0")}`;
}
