"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { StatusBadge, when } from "@/components/lab/shared";
import { statusClass } from "@/components/billing/status";
import { api, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";

type Row = {
  id: string; orderNo: string; status: string; createdAt: string; patient: { id: string; name: string; uhid: string | null };
  tests: number; resulted: number; abnormal: number; names: string[]; total: number; invoice: { id: string; number: string; status: string } | null;
};
const TABS = [["", "All"], ["ORDERED", "To collect"], ["COLLECTED", "Awaiting results"], ["RESULTED", "Resulted"], ["CANCELLED", "Cancelled"]] as const;

export default function LabBoard() {
  const [tab, setTab] = useState<string>("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (tab) p.set("status", tab);
    if (q.trim()) p.set("q", q.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const t = setTimeout(() => {
      api<{ orders: Row[] }>(`/api/lab/orders?${p}`).then((r) => {
        if (r.ok) { setRows(r.data.orders); setMsg(null); } else { setRows([]); setMsg({ ok: false, text: r.error }); }
      });
    }, 200);
    return () => clearTimeout(t);
  }, [tab, q, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Laboratory</h1>
          <p className="mt-1 text-sm text-ink/60">Order tests, collect samples, enter results and print reports.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/lab/tests" className="rounded-lg border border-forest px-4 py-2 text-sm text-forest hover:bg-forest/5">Test catalogue</Link>
          <Link href="/app/lab/new" className={btnPrimary}>New lab order</Link>
        </div>
      </div>
      <Notice msg={msg} />
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-forest text-cream" : "border border-sand text-ink/70"}`}>{label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order no, patient, phone, UHID" aria-label="Search" className={`${input} w-72`} />
        <label className="text-xs text-ink/60">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${input} ml-2`} /></label>
        <label className="text-xs text-ink/60">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${input} ml-2`} /></label>
        {(from || to || q) && <button onClick={() => { setFrom(""); setTo(""); setQ(""); }} className="text-sm text-forest hover:underline">Clear</button>}
      </div>

      {rows === null ? (
        <Card><p className="text-sm text-ink/60">Loading...</p></Card>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-ink/60">No lab orders match. {tab || q || from || to ? "Try clearing the filters." : "Create the first one with New lab order."}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-ink/50">
              <th className="px-6 py-3">Order</th><th className="px-6 py-3">Patient</th><th className="px-6 py-3">Tests</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3" />
            </tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3"><span className="font-data">{o.orderNo}</span><div className="text-xs text-ink/50">{when(o.createdAt)}</div></td>
                  <td className="px-6 py-3">{o.patient.name}<span className="ml-2 font-data text-xs text-ink/50">{o.patient.uhid}</span></td>
                  <td className="px-6 py-3 text-ink/70">
                    {o.names.join(", ")}{o.tests > o.names.length ? ` +${o.tests - o.names.length}` : ""}
                    <div className="text-xs text-ink/50">{o.resulted}/{o.tests} resulted{o.abnormal > 0 && <span className="ml-2 text-clay">{o.abnormal} abnormal</span>}</div>
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-6 py-3 font-data">{inr(o.total)}{o.invoice && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${statusClass(o.invoice.status)}`}>{o.invoice.status}</span>}</td>
                  <td className="px-6 py-3 text-right"><Link href={`/app/lab/${o.id}`} className="text-forest hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
