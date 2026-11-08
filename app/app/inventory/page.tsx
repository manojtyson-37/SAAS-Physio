"use client";

import { SearchSelect } from "@/components/SearchSelect";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, ExpiryTag, input, inr, LevelBadge, Notice, type Msg } from "@/components/pharmacy/ui";
import { useHasModule } from "@/components/ClinicContext";

type Item = {
  id: string; label: string; name: string; brand: string | null; unit: string; category: string; onHand: number; inDateQty: number;
  expiredQty: number; level: string; nextExpiry: string | null; nextExpiryStatus: string; price: number | null; reorderLevel: number; gstPercent: number;
};
type Alerts = { items: number; lowStock: number; outOfStock: number; expiringBatches: number; expiredBatches: number };
type Supplier = { id: string; name: string };
const CATS = ["Medicine", "Consumable", "Dental material", "Implant / ortho", "Other"];
const FILTERS: [string, string][] = [["", "All"], ["low", "Low"], ["out", "Out of stock"], ["expiring", "Expiring"], ["expired", "Has expired"]];
const blankItem = { name: "", brand: "", strength: "", form: "", unit: "tablet", category: "Medicine", gstPercent: "0", reorderLevel: "10" };
const blankRcv = { itemId: "", batchNo: "", expiryDate: "", qty: "", costPrice: "", salePrice: "", supplierId: "", note: "" };

export default function InventoryPage() {
  const pharmacyOn = useHasModule("pharmacy");
  const [items, setItems] = useState<Item[] | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState<"item" | "receive" | null>(null);
  const [item, setItem] = useState(blankItem);
  const [rcv, setRcv] = useState(blankRcv);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filter) qs.set("filter", filter);
    if (q.trim()) qs.set("q", q.trim());
    const r = await api<{ items: Item[]; alerts: Alerts }>(`/api/inventory/items?${qs}`);
    if (r.ok) { setItems(r.data.items); setAlerts(r.data.alerts); } else setMsg({ ok: false, text: r.error });
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => {
    fetch("/api/inventory/suppliers").then((r) => r.json()).then((d) => setSuppliers((d.suppliers ?? []).filter((x: { isActive: boolean }) => x.isActive))).catch(() => {});
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api("/api/inventory/items", "POST", item);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Item added. Receive stock to start selling it." });
    setItem(blankItem);
    setPanel(null);
    await load();
  }
  async function receive(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api("/api/inventory/receive", "POST", {
      ...rcv, expiryDate: rcv.expiryDate || undefined, supplierId: rcv.supplierId || undefined, note: rcv.note || undefined, costPrice: rcv.costPrice === "" ? undefined : rcv.costPrice,
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: `Received ${rcv.qty} units into batch ${rcv.batchNo}` });
    setRcv(blankRcv);
    setPanel(null);
    await load();
  }
  const pickItem = (id: string) => {
    const it = items?.find((i) => i.id === id);
    setRcv({ ...rcv, itemId: id, salePrice: it?.price != null && !rcv.salePrice ? String(it.price) : rcv.salePrice });
  };

  const statCls = (n: number, bad: boolean) => (bad && n > 0 ? "text-clay" : "text-ink");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-ink/60">Medicines and consumables by batch and expiry. Stock is dispensed oldest expiry first.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/inventory/suppliers" className={btnGhost}>Suppliers</Link>
          <button onClick={() => setPanel(panel === "item" ? null : "item")} className={btnGhost}>Add item</button>
          <button onClick={() => setPanel(panel === "receive" ? null : "receive")} className={btnPrimary}>Receive stock</button>
          {pharmacyOn && <Link href="/app/pharmacy" className={btnGhost}>Pharmacy</Link>}
        </div>
      </div>
      <Notice msg={msg} />

      {alerts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([["Low stock", alerts.lowStock, "low", true], ["Out of stock", alerts.outOfStock, "out", true], ["Expiring ≤ 90 days", alerts.expiringBatches, "expiring", true], ["Expired batches", alerts.expiredBatches, "expired", true]] as const).map(([label, n, f, bad]) => (
            <button key={f} onClick={() => setFilter(filter === f ? "" : f)} className={`rounded-xl border px-4 py-3 text-left ${filter === f ? "border-forest bg-forest/5" : "border-sand"}`}>
              <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">{label}</p>
              <p className={`mt-1 font-display text-2xl ${statCls(n, bad)}`}>{n}</p>
            </button>
          ))}
        </div>
      )}

      {panel === "item" && (
        <Card>
          <form onSubmit={addItem} className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs text-ink/60">Name* (generic for medicines)</label>
              <input required minLength={2} maxLength={120} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} className={`mt-1 block w-56 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Brand</label>
              <input maxLength={120} value={item.brand} onChange={(e) => setItem({ ...item, brand: e.target.value })} className={`mt-1 block w-36 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Strength</label>
              <input maxLength={40} placeholder="500 mg" value={item.strength} onChange={(e) => setItem({ ...item, strength: e.target.value })} className={`mt-1 block w-24 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Form</label>
              <input maxLength={40} placeholder="Tablet" value={item.form} onChange={(e) => setItem({ ...item, form: e.target.value })} className={`mt-1 block w-24 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Sold per</label>
              <input required maxLength={20} value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} className={`mt-1 block w-24 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Category</label>
              <select value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value })} className={`mt-1 block ${input}`}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-ink/60">GST %</label>
              <input type="number" min={0} max={28} step="0.01" value={item.gstPercent} onChange={(e) => setItem({ ...item, gstPercent: e.target.value })} className={`mt-1 block w-20 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Reorder at</label>
              <input type="number" min={0} value={item.reorderLevel} onChange={(e) => setItem({ ...item, reorderLevel: e.target.value })} className={`mt-1 block w-20 ${input}`} /></div>
            <button disabled={busy} className={btnPrimary}>Add item</button>
          </form>
          <p className="mt-2 text-xs text-ink/50">Medicines are matched to prescriptions by generic name, so enter the generic name (e.g. Paracetamol), not only the brand.</p>
        </Card>
      )}

      {panel === "receive" && (
        <Card>
          <form onSubmit={receive} className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs text-ink/60">Item*</label>
              <div className="mt-1 w-60"><SearchSelect required ariaLabel="Item" placeholder="Type to search items…" value={rcv.itemId} onChange={pickItem} options={(items ?? []).map((i) => ({ value: i.id, label: i.label }))} /></div></div>
            <div><label className="text-xs text-ink/60">Batch no.*</label>
              <input required maxLength={40} value={rcv.batchNo} onChange={(e) => setRcv({ ...rcv, batchNo: e.target.value })} className={`mt-1 block w-28 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Expiry</label>
              <input type="date" value={rcv.expiryDate} onChange={(e) => setRcv({ ...rcv, expiryDate: e.target.value })} className={`mt-1 block ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Quantity*</label>
              <input required type="number" min={1} step={1} value={rcv.qty} onChange={(e) => setRcv({ ...rcv, qty: e.target.value })} className={`mt-1 block w-24 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Cost ₹ / unit</label>
              <input type="number" min={0} step="0.01" value={rcv.costPrice} onChange={(e) => setRcv({ ...rcv, costPrice: e.target.value })} className={`mt-1 block w-24 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Sell ₹ / unit*</label>
              <input required type="number" min={0.01} step="0.01" value={rcv.salePrice} onChange={(e) => setRcv({ ...rcv, salePrice: e.target.value })} className={`mt-1 block w-24 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Supplier</label>
              <div className="mt-1 w-44"><SearchSelect allowClear ariaLabel="Supplier" placeholder="None" value={rcv.supplierId} onChange={(v) => setRcv({ ...rcv, supplierId: v })} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></div></div>
            <button disabled={busy} className={btnPrimary}>Add to stock</button>
          </form>
          <p className="mt-2 text-xs text-ink/50">Receiving the same batch number again adds to that batch (the expiry must match) and sets its selling price to the one you enter.</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Search stock" placeholder="Search name or brand" value={q} onChange={(e) => setQ(e.target.value)} className={`w-64 ${input}`} />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs ${filter === k ? "bg-forest text-cream" : "border border-sand text-ink/70"}`}>{label}</button>
          ))}
        </div>
      </div>

      {items && items.length === 0 && (
        <Card><p className="text-sm text-ink/70">{filter || q ? "Nothing matches." : "No stock items yet. Add an item, then receive stock into a batch."}</p></Card>
      )}
      {items && items.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
                <th className="px-6 py-3">Item</th><th className="px-6 py-3">In stock</th><th className="px-6 py-3">Next expiry</th><th className="px-6 py-3">Price</th><th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3">
                    <Link href={`/app/inventory/${i.id}`} className="text-forest hover:underline">{i.label}</Link>
                    <p className="text-xs text-ink/50">{[i.brand, i.category].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-6 py-3 font-data">
                    {i.inDateQty} <span className="text-xs text-ink/50">{i.unit}</span>
                    {i.expiredQty > 0 && <p className="text-xs text-clay">+{i.expiredQty} expired</p>}
                  </td>
                  <td className="px-6 py-3">{i.nextExpiry || i.inDateQty ? <ExpiryTag date={i.nextExpiry} status={i.nextExpiryStatus} /> : <span className="text-ink/40">—</span>}</td>
                  <td className="px-6 py-3 font-data">{i.price != null ? inr(i.price) : "—"}</td>
                  <td className="px-6 py-3"><LevelBadge level={i.level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
