"use client";

import { SearchSelect } from "@/components/SearchSelect";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";
import { useHasModule } from "@/components/ClinicContext";

type Opt = { id: string; label: string; unit: string; inDateQty: number; price: number | null; gstPercent: number };
type RxItem = { id: string; genericName: string; brandName: string | null; strength: string | null; form: string | null; dose: string | null; frequency: string; durationDays: number | null; instructions: string | null; suggestedQty: number | null; matches: Opt[] };
type Rx = { id: string; visitId: string; doctor: string; alreadyDispensed: boolean; patient: { id: string; name: string; uhid: string | null; allergies: string | null }; items: RxItem[] };
type Patient = { id: string; name: string; uhid: string | null; phone: string };
type Row = { key: string; rxText?: string; options: Opt[]; itemId: string; qty: string };
type Done = { id: string; invoiceId: string | null; invoiceNumber: string | null; total: number; replay: boolean };

const newRef = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
const rxText = (i: RxItem) => [i.brandName ?? i.genericName, i.strength, i.form, i.frequency && `· ${i.frequency}`, i.durationDays && `× ${i.durationDays}d`].filter(Boolean).join(" ");

function DispenseForm() {
  const sp = useSearchParams();
  const rxId = sp.get("rx");
  const billingOn = useHasModule("billing");
  const [rx, setRx] = useState<Rx | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [stock, setStock] = useState<Opt[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Patient[]>([]);
  const [ref, setRef] = useState(newRef);
  const [refill, setRefill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Opt[] & { name: string }[] }>("/api/inventory/items").then((r) => {
      if (r.ok) setStock((r.data.items as unknown as Opt[]).filter((i) => i.inDateQty > 0));
    });
  }, []);
  useEffect(() => {
    if (!rxId) return;
    api<{ prescription: Rx }>(`/api/pharmacy/rx/${rxId}`).then((r) => {
      if (!r.ok) return setLoadError(r.error);
      const p = r.data.prescription;
      setRx(p);
      setPatient({ id: p.patient.id, name: p.patient.name, uhid: p.patient.uhid, phone: "" });
      setRows(p.items.map((it) => {
        // Pre-select only when exactly one in-stock product matches; otherwise the pharmacist chooses.
        const inStock = it.matches.filter((m) => m.inDateQty > 0);
        const best = inStock.length === 1 ? inStock[0] : undefined;
        return { key: it.id, rxText: rxText(it), options: it.matches, itemId: best?.id ?? "", qty: String(it.suggestedQty ?? 1) };
      }));
    });
  }, [rxId]);
  useEffect(() => {
    if (rxId || q.trim().length < 2) return;
    const t = setTimeout(() => {
      api<{ patients: Patient[] }>(`/api/patients?q=${encodeURIComponent(q.trim())}`).then((r) => { if (r.ok) setFound(r.data.patients.slice(0, 6)); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, rxId]);

  const optOf = (r: Row) => [...r.options, ...stock].find((o) => o.id === r.itemId);
  const active = rows.filter((r) => r.itemId && Number(r.qty) >= 1);
  const estimate = useMemo(
    () => active.reduce((s, r) => { const o = [...r.options, ...stock].find((x) => x.id === r.itemId); return s + (o?.price ?? 0) * Number(r.qty) * (1 + (o?.gstPercent ?? 0) / 100); }, 0),
    [active, stock]
  );
  const overStock = active.some((r) => Number(r.qty) > (optOf(r)?.inDateQty ?? 0));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || active.length === 0) return;
    setBusy(true);
    setMsg(null);
    const r = await api<Done>("/api/pharmacy/dispense", "POST", {
      patientId: patient.id, prescriptionId: rx?.id, visitId: rx?.visitId, discount: discount || 0, notes: notes || undefined, clientRef: ref, refill: refill || undefined,
      lines: active.map((x) => ({ itemId: x.itemId, qty: Number(x.qty) })),
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setDone(r.data);
    setRef(newRef());
  }

  if (loadError) return <p className="text-sm text-ink/60">{loadError}. <Link href="/app/pharmacy" className="text-forest underline">Back to pharmacy</Link></p>;

  if (done) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">Dispensed</h1>
        <Card>
          <p className="text-sm">Total <span className="font-data font-medium">{inr(done.total)}</span> for {patient?.name}. Stock has been reduced, oldest expiry first.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {done.invoiceId && <Link href={`/app/invoices/${done.invoiceId}`} className={btnPrimary}>Take payment · {done.invoiceNumber}</Link>}
            <Link href={`/app/pharmacy/${done.id}`} className={btnGhost}>View details</Link>
            <Link href="/app/pharmacy" className={btnGhost}>Back to pharmacy</Link>
          </div>
          {!done.invoiceId && <p className="mt-3 text-xs text-ink/50">Billing is not enabled for this clinic, so no invoice was created.</p>}
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Link href="/app/pharmacy" className="text-sm text-forest hover:underline">← Pharmacy</Link>
      <div><h1 className="font-display text-3xl">{rx ? "Dispense prescription" : "Counter sale"}</h1>
        <p className="mt-1 text-sm text-ink/60">{rx ? `Prescribed by ${rx.doctor}` : "Sell medicines or supplies without a prescription."}</p></div>
      <Notice msg={msg} />

      {!rxId && !patient && (
        <Card>
          <label className="text-xs text-ink/60">Find patient (name, phone or UHID)</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} className={`mt-1 block w-72 ${input}`} />
          {found.length > 0 && (
            <ul className="mt-2 divide-y divide-sand/60 text-sm">
              {found.map((p) => (
                <li key={p.id}><button type="button" onClick={() => setPatient(p)} className="w-full py-2 text-left hover:text-forest">{p.name} <span className="font-data text-xs text-ink/50">{p.uhid} · {p.phone}</span></button></li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {patient && (
        <Card>
          <p className="text-sm"><span className="font-medium">{patient.name}</span> <span className="font-data text-xs text-ink/50">{patient.uhid}</span>
            {!rxId && <button type="button" onClick={() => { setPatient(null); setRows([]); }} className="ml-3 text-xs text-forest hover:underline">Change</button>}</p>
          {rx?.patient.allergies && <p className="mt-2 rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">Allergies on file: {rx.patient.allergies}</p>}
          {rx?.alreadyDispensed && <p className="mt-2 rounded-lg bg-sand px-3 py-2 text-sm text-ink/70">This prescription was already dispensed once. Dispense again only for a refill.
            <label className="ml-2 inline-flex items-center gap-1"><input type="checkbox" checked={refill} onChange={(e) => setRefill(e.target.checked)} /> This is a refill</label></p>}
        </Card>
      )}

      {patient && (
        <Card className="space-y-3">
          {rows.map((r) => {
            const o = optOf(r);
            return (
              <div key={r.key} className="flex flex-wrap items-end gap-3 border-b border-sand/60 pb-3 last:border-0">
                <div className="min-w-[14rem] flex-1">
                  {r.rxText && <p className="text-sm font-medium">{r.rxText}</p>}
                  <SearchSelect ariaLabel="Stock item" className="mt-1" placeholder={r.rxText && r.options.length === 0 ? "Not in your stock list" : "Choose item… type to search"} value={r.itemId} onChange={(v) => setRows(rows.map((x) => (x.key === r.key ? { ...x, itemId: v } : x)))} options={(r.options.length ? r.options : stock).map((s) => ({ value: s.id, label: s.label, hint: `${s.inDateQty} ${s.unit}${s.price != null ? ` · ${inr(s.price)}` : ""}` }))} />
                </div>
                <div><label className="text-xs text-ink/60">Qty{o ? ` (max ${o.inDateQty})` : ""}</label>
                  <input type="number" min={1} step={1} value={r.qty} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))} className={`mt-1 block w-24 ${input}`} /></div>
                <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="pb-2 text-sm text-ink/50 hover:text-clay">Remove</button>
              </div>
            );
          })}
          <button type="button" onClick={() => setRows([...rows, { key: newRef(), options: [], itemId: "", qty: "1" }])} className="text-sm text-forest hover:underline">+ Add another item</button>
        </Card>
      )}

      {patient && (
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            {billingOn && <div><label className="text-xs text-ink/60">Discount ₹</label>
              <input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={`mt-1 block w-28 ${input}`} /></div>}
            <div className="flex-1"><label className="text-xs text-ink/60">Note</label>
              <input maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 block w-full ${input}`} /></div>
            <div className="text-right"><p className="text-xs text-ink/50">Estimated total</p><p className="font-display text-2xl">{inr(Math.round(estimate * 100) / 100)}</p></div>
          </div>
          <p className="mt-2 text-xs text-ink/50">Final price follows the batches used (each batch has its own selling price).</p>
          {overStock && <p className="mt-2 text-sm text-clay">A quantity is more than the in-date stock.</p>}
          <button disabled={busy || active.length === 0 || overStock} className={`mt-4 ${btnPrimary}`}>{busy ? "Dispensing…" : "Dispense"}</button>
        </Card>
      )}
    </form>
  );
}

export default function DispensePage() {
  return <Suspense fallback={<p className="text-sm text-ink/50">Loading…</p>}><DispenseForm /></Suspense>;
}
