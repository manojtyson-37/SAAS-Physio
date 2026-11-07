"use client";

import { useEffect, useMemo, useState } from "react";
import { BillingError, computeInvoice, toPaise } from "@/lib/hospital/billing";

export type FormLine = { description: string; qty: string; unitPrice: string; gstPercent: string };
export type FormValue = { lines: FormLine[]; discount: string; notes: string };
type Service = { id: string; name: string; category: string; price: number; gstPercent: number };

export const emptyLine = (): FormLine => ({ description: "", qty: "1", unitPrice: "", gstPercent: "0" });
export const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const input = "rounded-lg border border-sand px-3 py-2 text-sm";

/** Shared by "new invoice" and "edit invoice". Totals are computed with the same code the server uses. */
export default function InvoiceForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  error,
}: {
  value: FormValue;
  onChange: (v: FormValue) => void;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  error: string | null;
}) {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : { services: [] }))
      .then((d) => setServices(d.services ?? []))
      .catch(() => setServices([]));
  }, []);

  const { lines, discount, notes } = value;
  const setLine = (i: number, patch: Partial<FormLine>) =>
    onChange({ ...value, lines: lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });

  const preview = useMemo(() => {
    try {
      const parsed = lines.map((l) => ({
        description: l.description || "-",
        qty: Math.max(0, Math.floor(Number(l.qty) || 0)),
        unitPrice: Number(l.unitPrice) || 0,
        gstPercent: Number(l.gstPercent) || 0,
      }));
      if (parsed.every((l) => l.unitPrice <= 0)) {
        return { totals: null, problem: "Add a service or enter a price to see the total", neutral: true };
      }
      return { totals: computeInvoice(parsed, Number(discount) || 0), problem: null as string | null, neutral: false };
    } catch (e) {
      return { totals: null, problem: e instanceof BillingError ? e.message : "Check the amounts", neutral: false };
    }
  }, [lines, discount]);

  const addService = (id: string) => {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    const line = { description: s.name, qty: "1", unitPrice: String(s.price), gstPercent: String(s.gstPercent) };
    const onlyBlank = lines.length === 1 && !lines[0].description && !lines[0].unitPrice;
    onChange({ ...value, lines: onlyBlank ? [line] : [...lines, line] });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-ink/60">Add from price list</label>
          <select
            value=""
            onChange={(e) => addService(e.target.value)}
            className={`mt-1 block w-64 ${input}`}
          >
            <option value="">{services.length ? "— choose a service —" : "No price list yet"}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {inr(s.price)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, lines: [...lines, emptyLine()] })}
          className="rounded-lg border border-sand px-3 py-2 text-sm hover:bg-sand/40"
        >
          + Custom line
        </button>
      </div>

      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_70px_110px_80px_36px] gap-2 text-[10px] uppercase tracking-widest text-ink/40 sm:grid">
          <span>Description</span><span>Qty</span><span>Unit price ₹</span><span>GST %</span><span />
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_70px_110px_80px_36px]">
            <input
              aria-label="Description"
              placeholder="Description"
              value={l.description}
              onChange={(e) => setLine(i, { description: e.target.value })}
              className={`col-span-2 sm:col-span-1 ${input}`}
            />
            <input aria-label="Quantity" type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className={input} />
            <input aria-label="Unit price" type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} className={input} />
            <input aria-label="GST percent" type="number" min={0} max={28} step="0.01" value={l.gstPercent} onChange={(e) => setLine(i, { gstPercent: e.target.value })} className={input} />
            <button
              type="button"
              aria-label="Remove line"
              disabled={lines.length === 1}
              onClick={() => onChange({ ...value, lines: lines.filter((_, idx) => idx !== i) })}
              className="rounded-lg text-ink/40 hover:bg-sand/60 hover:text-ink disabled:opacity-30"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-ink/60">Discount ₹ (optional)</label>
            <input type="number" min={0} step="0.01" value={discount} onChange={(e) => onChange({ ...value, discount: e.target.value })} className={`mt-1 block w-40 ${input}`} />
          </div>
          <div>
            <label className="text-xs text-ink/60">Notes (optional)</label>
            <textarea rows={2} maxLength={500} value={notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} className={`mt-1 block w-full ${input}`} />
          </div>
        </div>
        <div className="rounded-xl bg-sand/40 p-4 text-sm">
          {preview.totals ? (
            <div className="space-y-1">
              <Row k="Subtotal" v={inr(preview.totals.subtotalPaise / 100)} />
              <Row k="GST" v={inr(preview.totals.gstPaise / 100)} />
              {preview.totals.discountPaise > 0 && <Row k="Discount" v={`− ${inr(preview.totals.discountPaise / 100)}`} />}
              <div className="flex justify-between border-t border-sand pt-1 text-base font-medium">
                <span>Total</span>
                <span className="font-data">{inr(preview.totals.totalPaise / 100)}</span>
              </div>
            </div>
          ) : (
            <p className={preview.neutral ? "text-ink/50" : "text-clay"}>{preview.problem}</p>
          )}
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">{error}</p>}

      <button
        disabled={saving || !preview.totals || lines.some((l) => !l.description.trim() || toPaise(Number(l.unitPrice)) <= 0)}
        className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-50"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/60">{k}</span>
      <span className="font-data">{v}</span>
    </div>
  );
}
