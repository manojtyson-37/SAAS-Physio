"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import Link from "next/link";
import { inr } from "@/components/billing/InvoiceForm";
import { statusClass } from "@/components/billing/status";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d: string) =>
  new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const [missing, setMissing] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  // One id per payment attempt: a double click or a retry cannot record the same payment twice.
  const attempt = useRef(crypto.randomUUID());

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) return setMissing(true);
    const inv = (await res.json()).invoice;
    setInvoice(inv);
    setAmount(inv.balance > 0 ? String(inv.balance) : "");
  }, [id]);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(async (res) => {
        if (!res.ok) return setMissing(true);
        const inv = (await res.json()).invoice;
        setInvoice(inv);
        setAmount(inv.balance > 0 ? String(inv.balance) : "");
      })
      .catch(() => setMissing(true));
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRole(d?.user?.role ?? d?.role ?? ""))
      .catch(() => {});
  }, [id]);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, amount: Number(amount), reference: reference || undefined, clientRef: attempt.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Could not record payment" });
      attempt.current = crypto.randomUUID();
      setReference("");
      setMsg({ ok: true, text: "Payment recorded" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvoice() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Could not cancel" });
      setCancelling(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (missing) return <p className="text-sm text-ink/60">Invoice not found. <Link className="text-forest" href="/app/invoices">Back to invoices</Link></p>;
  if (!invoice) return <p className="text-sm text-ink/50">Loading…</p>;

  const canWrite = role === "CLINIC_ADMIN" || role === "STAFF";
  const cancelled = invoice.status === "CANCELLED";
  const canEdit = canWrite && !cancelled && invoice.payments.length === 0;
  const canCancel = role === "CLINIC_ADMIN" && !cancelled && invoice.payments.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/app/invoices" className="text-sm text-ink/50 hover:text-ink">← All invoices</Link>
        <div className="flex gap-2">
          {canEdit && <Link href={`/app/invoices/${id}/edit`} className="rounded-full border border-ink/15 px-5 py-2 text-sm hover:border-ink/30">Edit</Link>}
          <button onClick={() => window.print()} className="rounded-full border border-ink/15 px-5 py-2 text-sm hover:border-ink/30">Print</button>
        </div>
      </div>

      <div className="rounded-2xl border border-sand bg-white p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">{invoice.gst > 0 ? "Tax invoice" : "Invoice"}</p>
            <p className="mt-1 font-display text-2xl">{invoice.number}</p>
            <p className="mt-1 text-sm text-ink/50">Issued {fmtDate(invoice.date)}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-display">{invoice.tenant.name}</p>
            {invoice.tenant.address && <p className="text-ink/50">{invoice.tenant.address}</p>}
            {invoice.tenant.phone && <p className="text-ink/50">{invoice.tenant.phone}</p>}
            {invoice.tenant.gstNumber && <p className="text-ink/50">GSTIN: {invoice.tenant.gstNumber}</p>}
          </div>
        </div>

        <div className="mt-8 flex items-start justify-between gap-4">
          <div>
            <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">Billed to</p>
            <p className="mt-1 font-medium">{invoice.patient.name}</p>
            {invoice.patient.uhid && <p className="font-data text-xs text-ink/50">UHID {invoice.patient.uhid}</p>}
            <p className="text-sm text-ink/50">{invoice.patient.phone}</p>
            {invoice.patient.address && <p className="text-sm text-ink/50">{invoice.patient.address}</p>}
            {invoice.visit && <p className="mt-1 text-xs text-ink/50">OPD visit · token {invoice.visit.tokenNumber}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs uppercase ${statusClass(invoice.status)}`}>{invoice.status}</span>
        </div>

        {cancelled && (
          <p className="mt-4 rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/70">
            Cancelled {invoice.cancelledAt ? fmtDate(invoice.cancelledAt) : ""}: {invoice.cancelReason}
          </p>
        )}

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
                <th className="py-2">Description</th><th className="py-2">Qty</th><th className="py-2">Unit</th><th className="py-2">GST</th>
                <th className="py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li: any) => (
                <tr key={li.id} className="border-b border-sand/60">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2">{li.qty}</td>
                  <td className="py-2">{inr(li.unitPrice)}</td>
                  <td className="py-2">{li.gstPercent}%</td>
                  <td className="py-2 text-right font-data">{inr(li.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
          <Line k="Subtotal" v={inr(invoice.subtotal)} />
          <Line k="GST" v={inr(invoice.gst)} />
          {invoice.discount > 0 && <Line k="Discount" v={`− ${inr(invoice.discount)}`} />}
          <div className="flex justify-between border-t border-sand pt-1 font-medium">
            <span>Total</span><span className="font-data text-lg">{inr(invoice.total)}</span>
          </div>
          <Line k="Paid" v={inr(invoice.paidAmount)} />
          <div className="flex justify-between font-medium"><span>Balance due</span><span className="font-data">{inr(invoice.balance)}</span></div>
        </div>
        <p className="mt-4 text-xs text-ink/50">{invoice.totalInWords}</p>
        {invoice.notes && <p className="mt-3 text-sm text-ink/70">Note: {invoice.notes}</p>}

        {invoice.payments.length > 0 && (
          <div className="mt-8">
            <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">Payments received</p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {invoice.payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-sand/60">
                    <td className="py-2">{p.method}{p.reference && <span className="ml-2 font-data text-xs text-ink/40">{p.reference}</span>}</td>
                    <td className="py-2 text-ink/50">{fmtTime(p.date)}{p.receivedBy?.name && ` · ${p.receivedBy.name}`}</td>
                    <td className="py-2 text-right font-data">{inr(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm print:hidden ${msg.ok ? "bg-forest/10 text-forest" : "bg-clay-light text-clay"}`}>{msg.text}</p>}

      {canWrite && !cancelled && invoice.balance > 0 && (
        <form onSubmit={recordPayment} className="flex flex-wrap items-end gap-3 print:hidden">
          <div>
            <label className="text-xs text-ink/60">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 block rounded-lg border border-sand px-3 py-2 text-sm">
              {["Cash", "UPI", "Card", "Netbanking"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/60">Amount ₹ (balance {inr(invoice.balance)})</label>
            <input required type="number" min={0.01} max={invoice.balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-36 rounded-lg border border-sand px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink/60">Reference (optional)</label>
            <input maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI txn id / last 4 digits" className="mt-1 block w-52 rounded-lg border border-sand px-3 py-2 text-sm" />
          </div>
          <button disabled={busy} className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60">
            {busy ? "Saving…" : "Record payment"}
          </button>
        </form>
      )}

      {canCancel && (
        <div className="print:hidden">
          {!cancelling ? (
            <button onClick={() => setCancelling(true)} className="text-sm text-clay hover:underline">Cancel this invoice</button>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" maxLength={300} className="w-72 rounded-lg border border-sand px-3 py-2 text-sm" />
              <button disabled={busy || reason.trim().length < 3} onClick={cancelInvoice} className="rounded-lg bg-clay px-4 py-2 text-sm text-white disabled:opacity-50">Confirm cancel</button>
              <button onClick={() => setCancelling(false)} className="text-sm text-ink/60">Keep invoice</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-ink/50">{k}</span><span className="font-data">{v}</span></div>;
}
