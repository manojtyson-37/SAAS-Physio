"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, fmtDay, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";

type Line = { id: string; label: string; unit: string; batchNo: string; expiry: string | null; qty: number; unitPrice: number; gstPercent: number; lineTotal: number };
type D = { id: string; status: string; voidReason: string | null; total: number; at: string; notes: string | null; patient: { id: string; name: string; uhid: string | null }; invoice: { id: string; number: string; status: string } | null; by: string | null; lines: Line[] };

export default function DispensationPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<D | null>(null);
  const [missing, setMissing] = useState(false);
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const fetchIt = () => api<{ dispensation: D }>(`/api/pharmacy/dispensations/${id}`).then((r) => (r.ok ? setD(r.data.dispensation) : setMissing(true)));
  useEffect(() => { void fetchIt(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doVoid(e: React.FormEvent) {
    e.preventDefault();
    const r = await api(`/api/pharmacy/dispensations/${id}/void`, "POST", { reason });
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Voided. Stock returned to its batches." });
    setVoiding(false);
    await fetchIt();
  }

  if (missing) return <p className="text-sm text-ink/60">Not found. <Link href="/app/pharmacy" className="text-forest underline">Back to pharmacy</Link></p>;
  if (!d) return <p className="text-sm text-ink/50">Loading…</p>;
  const voided = d.status === "VOIDED";

  return (
    <div className="space-y-6">
      <Link href="/app/pharmacy" className="text-sm text-forest hover:underline">← Pharmacy</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Dispensed to {d.patient.name}</h1>
          <p className="mt-1 text-sm text-ink/60">{d.patient.uhid} · {new Date(d.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}{d.by && ` · by ${d.by}`}</p>
        </div>
        <div className="flex gap-2">
          {d.invoice && <Link href={`/app/invoices/${d.invoice.id}`} className={btnGhost}>Invoice {d.invoice.number} ({d.invoice.status})</Link>}
          {!voided && <button onClick={() => setVoiding(!voiding)} className={btnGhost}>Void / return</button>}
        </div>
      </div>
      <Notice msg={msg} />
      {voided && <p className="rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">Voided: {d.voidReason}. The stock was returned.</p>}
      {voiding && (
        <Card>
          <form onSubmit={doVoid} className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs text-ink/60">Reason*</label><input required minLength={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={`mt-1 block w-72 ${input}`} /></div>
            <button className="rounded-lg bg-clay px-5 py-2 text-sm font-medium text-cream">Void and return stock</button>
          </form>
          <p className="mt-2 text-xs text-ink/50">An unpaid invoice is cancelled with it. If a payment was recorded, cancel the invoice first.</p>
        </Card>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40"><th className="px-6 py-3">Item</th><th className="px-6 py-3">Batch</th><th className="px-6 py-3">Qty</th><th className="px-6 py-3">Rate</th><th className="px-6 py-3 text-right">Total</th></tr></thead>
          <tbody>
            {d.lines.map((l) => (
              <tr key={l.id} className="border-b border-sand/60 last:border-0">
                <td className="px-6 py-3">{l.label}</td>
                <td className="px-6 py-3 font-data text-xs">{l.batchNo}<span className="ml-1 text-ink/50">{fmtDay(l.expiry)}</span></td>
                <td className="px-6 py-3 font-data">{l.qty} {l.unit}</td>
                <td className="px-6 py-3 font-data">{inr(l.unitPrice)}{l.gstPercent ? ` + ${l.gstPercent}%` : ""}</td>
                <td className="px-6 py-3 text-right font-data">{inr(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4} className="px-6 py-3 text-right text-ink/60">Total (after any discount)</td><td className="px-6 py-3 text-right font-data font-medium">{inr(d.total)}</td></tr></tfoot>
        </table>
      </Card>
    </div>
  );
}
