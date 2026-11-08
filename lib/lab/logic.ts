import { computeInvoice } from "@/lib/hospital/billing";

export type Flag = "NORMAL" | "LOW" | "HIGH" | "CRITICAL";
export const FLAGS: Flag[] = ["NORMAL", "LOW", "HIGH", "CRITICAL"];

/** "LAB" + 42 -> "LAB-000042". Sequences past 6 digits are kept whole. */
export const formatLabOrderNo = (seq: number) => `LAB-${String(seq).padStart(6, "0")}`;

/** Strict numeric parse: "12.5" -> 12.5, but "<5", "12 mg", "" and "1e3" are free text (null). Rounded to the 4 decimals we store. */
export function parseNumeric(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!/^-?\d{1,10}(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s) * 10_000) / 10_000;
  return Number.isFinite(n) ? n : null;
}

/** LOW below refLow, HIGH above refHigh, NORMAL inside (bounds inclusive). No value or no range means no flag (null). */
export function flagResult(value: number | null, refLow: number | null, refHigh: number | null): "NORMAL" | "LOW" | "HIGH" | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (refLow === null && refHigh === null) return null;
  if (refLow !== null && value < refLow) return "LOW";
  if (refHigh !== null && value > refHigh) return "HIGH";
  return "NORMAL";
}

/** The flag stored for a result: the technician's override wins, otherwise computed from the range. */
export function effectiveFlag(value: string, refLow: number | null, refHigh: number | null, override?: Flag | null): Flag | null {
  return override ?? flagResult(parseNumeric(value), refLow, refHigh);
}

/** "3.5 - 5.1", "up to 5", "from 2" or the free-text range. Empty string when none is defined. */
export function rangeText(i: { refLow: number | null; refHigh: number | null; refText?: string | null }): string {
  if (i.refLow !== null && i.refHigh !== null) return `${i.refLow} - ${i.refHigh}`;
  if (i.refHigh !== null) return `up to ${i.refHigh}`;
  if (i.refLow !== null) return `from ${i.refLow}`;
  return i.refText ?? "";
}

/** Order total in paise (what the invoice would be), GST included. */
export function orderTotals(items: { price: number; gstPercent: number }[]) {
  if (items.length === 0) return { subtotalPaise: 0, gstPaise: 0, totalPaise: 0 };
  const c = computeInvoice(items.map((i, n) => ({ description: `t${n}`, qty: 1, unitPrice: i.price, gstPercent: i.gstPercent })));
  return { subtotalPaise: c.subtotalPaise, gstPaise: c.gstPaise, totalPaise: c.totalPaise };
}

export type LabStatus = "ORDERED" | "COLLECTED" | "RESULTED" | "CANCELLED";

/** Allowed status moves. RESULTED -> RESULTED is a correction, handled separately (audited). */
export const LAB_TRANSITIONS: Record<LabStatus, LabStatus[]> = {
  ORDERED: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["RESULTED", "CANCELLED"],
  RESULTED: [],
  CANCELLED: [],
};
export const canLabTransition = (from: LabStatus, to: LabStatus) => LAB_TRANSITIONS[from].includes(to);

/** Status after a result save: RESULTED once every item has a value, otherwise it stays COLLECTED. */
export const statusAfterResults = (values: (string | null)[]): "COLLECTED" | "RESULTED" =>
  values.length > 0 && values.every((v) => !!v && v.trim() !== "") ? "RESULTED" : "COLLECTED";

/** Is the stored value different from the submitted one (numeric-aware: "5" equals "5.0")? */
export function resultChanged(prev: string | null, next: string): boolean {
  if (prev === null) return true;
  const a = parseNumeric(prev), b = parseNumeric(next);
  if (a !== null && b !== null) return a !== b;
  return prev.trim() !== next.trim();
}
