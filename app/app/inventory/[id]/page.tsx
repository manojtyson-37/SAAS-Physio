"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, ExpiryTag, input, inr, LevelBadge, Notice, type Msg } from "@/components/pharmacy/ui";

type Item = { id: string; label: string; name: string; brand: string | null; form: string | null; strength: string | null; unit: string; category: string; hsn: string | null; gstPercent: number; reorderLevel: number; isActive: boolean; onHand: number; inDateQty: number; level: string };
type Batch = { id: string; batchNo: string; expiryDate: string | null; expiryStatus: string; qtyOnHand: number; costPrice: number; salePrice: number; supplier: string | null };
type Move = { id: string; type: string; qty: number; note: string | null; batchNo: string; by: string | null; at: string };
const MOVE_LABEL: Record<string, string> = { RECEIPT: "Received", DISPENSE: "Dispensed", ADJUSTMENT: "Count correction", WRITE_OFF: "Written off", VOID_RETURN: "Returned (voided sale)" };

export default function InventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [missing, setMissing] = useState(false);
  const [edit, setEdit] = useState<{ name: string; brand: string; strength: string; form: string; unit: string; gstPercent: string; reorderLevel: string } | null>(null);
  const [adj, setAdj] = useState<{ batchId: string; delta: string; type: "ADJUSTMENT" | "WRITE_OFF"; note: string } | null>(null);
  const [price, setPrice] = useState<{ batchId: string; salePrice: string; costPrice: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ item: Item; batches: Batch[]; movements: Move[] }>(`/api/inventory/items/${id}`);
    if (!r.ok) return setMissing(true);
    setItem(r.data.item); setBatches(r.data.batches); setMoves(r.data.movements);
  }, [id]);
  useEffect(() => {
    api<{ item: Item; batches: Batch[]; movements: Move[] }>(`/api/inventory/items/${id}`).then((r) => {
      if (!r.ok) return setMissing(true);
      setItem(r.data.item); setBatches(r.data.batches); setMoves(r.data.movements);
    });
  }, [id]);

  async function run(p: Promise<{ ok: boolean; error?: string }>, ok: string, done: () => void) {
    const r = await p;
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Something went wrong" });
    setMsg({ ok: true, text: ok });
    done();
    await load();
  }

  if (missing) return <p className="text-sm text-ink/60">Item not found. <Link href="/app/inventory" className="text-forest underline">Back to inventory</Link></p>;
  if (!item) return <p className="text-sm text-ink/50">Loading…</p>;

  return (
    <div className="space-y-6">
      <Link href="/app/inventory" className="text-sm text-forest hover:underline">← Inventory</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{item.label}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {[item.brand, item.category, `GST ${item.gstPercent}%`, `reorder at ${item.reorderLevel}`].filter(Boolean).join(" · ")}
            {!item.isActive && " · inactive"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LevelBadge level={item.level} />
          <button onClick={() => setEdit({ name: item.name, brand: item.brand ?? "", strength: item.strength ?? "", form: item.form ?? "", unit: item.unit, gstPercent: String(item.gstPercent), reorderLevel: String(item.reorderLevel) })} className={btnGhost}>Edit item</button>
          <button onClick={() => run(api(`/api/inventory/items/${id}`, "PATCH", { isActive: !item.isActive }), item.isActive ? "Item deactivated. History is kept." : "Item activated", () => {})} className={btnGhost}>{item.isActive ? "Deactivate" : "Activate"}</button>
        </div>
      </div>
      <Notice msg={msg} />

      {edit && (
        <Card>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void run(api(`/api/inventory/items/${id}`, "PATCH", { ...edit, brand: edit.brand || null, strength: edit.strength || null, form: edit.form || null }), "Saved", () => setEdit(null)); }}>
            {([["name", "Name", "w-56"], ["brand", "Brand", "w-36"], ["strength", "Strength", "w-24"], ["form", "Form", "w-24"], ["unit", "Sold per", "w-24"]] as const).map(([k, label, w]) => (
              <div key={k}><label className="text-xs text-ink/60">{label}</label>
                <input required={k === "name" || k === "unit"} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className={`mt-1 block ${w} ${input}`} /></div>
            ))}
            <div><label className="text-xs text-ink/60">GST %</label>
              <input type="number" min={0} max={28} step="0.01" value={edit.gstPercent} onChange={(e) => setEdit({ ...edit, gstPercent: e.target.value })} className={`mt-1 block w-20 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Reorder at</label>
              <input type="number" min={0} value={edit.reorderLevel} onChange={(e) => setEdit({ ...edit, reorderLevel: e.target.value })} className={`mt-1 block w-20 ${input}`} /></div>
            <button className={btnPrimary}>Save</button>
            <button type="button" onClick={() => setEdit(null)} className="text-sm text-ink/50">Cancel</button>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <div className="px-6 pt-4"><p className="font-data text-[10px] uppercase tracking-widest text-ink/40">Batches · {item.inDateQty} in date of {item.onHand} on hand</p></div>
        {batches.length === 0 ? <p className="px-6 py-4 text-sm text-ink/50">No stock received yet.</p> : (
          <table className="mt-2 w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
              <th className="px-6 py-2">Batch</th><th className="px-6 py-2">Expiry</th><th className="px-6 py-2">Qty</th><th className="px-6 py-2">Cost</th><th className="px-6 py-2">Sell</th><th className="px-6 py-2">Supplier</th><th className="px-6 py-2" />
            </tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className={`border-b border-sand/60 last:border-0 ${b.qtyOnHand === 0 ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3 font-data">{b.batchNo}</td>
                  <td className="px-6 py-3"><ExpiryTag date={b.expiryDate} status={b.expiryStatus} /></td>
                  <td className="px-6 py-3 font-data">{b.qtyOnHand}</td>
                  {price?.batchId === b.id ? (
                    <>
                      <td className="px-6 py-2"><input aria-label="Cost price" type="number" min={0} step="0.01" value={price.costPrice} onChange={(e) => setPrice({ ...price, costPrice: e.target.value })} className={`w-20 ${input}`} /></td>
                      <td className="px-6 py-2"><input aria-label="Selling price" type="number" min={0.01} step="0.01" value={price.salePrice} onChange={(e) => setPrice({ ...price, salePrice: e.target.value })} className={`w-20 ${input}`} /></td>
                      <td className="px-6 py-2" />
                      <td className="px-6 py-2 text-right">
                        <button onClick={() => run(api(`/api/inventory/batches/${b.id}`, "PATCH", { salePrice: price.salePrice, costPrice: price.costPrice }), "Prices saved", () => setPrice(null))} className="text-forest hover:underline">Save</button>
                        <button onClick={() => setPrice(null)} className="ml-3 text-ink/50">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 font-data">{inr(b.costPrice)}</td>
                      <td className="px-6 py-3 font-data">{inr(b.salePrice)}</td>
                      <td className="px-6 py-3 text-ink/60">{b.supplier ?? "—"}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => setPrice({ batchId: b.id, salePrice: String(b.salePrice), costPrice: String(b.costPrice) })} className="text-forest hover:underline">Prices</button>
                        <button onClick={() => setAdj({ batchId: b.id, delta: "", type: b.expiryStatus === "EXPIRED" ? "WRITE_OFF" : "ADJUSTMENT", note: "" })} className="ml-3 text-forest hover:underline">Adjust</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {adj && (
        <Card>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void run(api("/api/inventory/adjust", "POST", { ...adj, delta: adj.type === "WRITE_OFF" ? -Math.abs(Number(adj.delta)) : Number(adj.delta) }), "Stock updated", () => setAdj(null)); }}>
            <div><label className="text-xs text-ink/60">Type</label>
              <select value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value as "ADJUSTMENT" | "WRITE_OFF" })} className={`mt-1 block ${input}`}>
                <option value="ADJUSTMENT">Count correction (+/−)</option><option value="WRITE_OFF">Write off (expired / damaged)</option></select></div>
            <div><label className="text-xs text-ink/60">{adj.type === "WRITE_OFF" ? "Units to remove*" : "Change* (e.g. -3 or 5)"}</label>
              <input required type="number" step={1} value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} className={`mt-1 block w-28 ${input}`} /></div>
            <div><label className="text-xs text-ink/60">Reason*</label>
              <input required minLength={3} maxLength={200} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} className={`mt-1 block w-64 ${input}`} /></div>
            <button className={btnPrimary}>Apply</button>
            <button type="button" onClick={() => setAdj(null)} className="text-sm text-ink/50">Cancel</button>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <div className="px-6 pt-4"><p className="font-data text-[10px] uppercase tracking-widest text-ink/40">Recent stock movements</p></div>
        {moves.length === 0 ? <p className="px-6 py-4 text-sm text-ink/50">Nothing yet.</p> : (
          <table className="mt-2 w-full text-sm">
            <tbody>
              {moves.map((m) => (
                <tr key={m.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-2 text-ink/60">{new Date(m.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-6 py-2">{MOVE_LABEL[m.type] ?? m.type}{m.note && <span className="text-ink/50"> · {m.note}</span>}</td>
                  <td className="px-6 py-2 font-data text-ink/60">{m.batchNo}</td>
                  <td className={`px-6 py-2 text-right font-data ${m.qty < 0 ? "text-clay" : "text-forest"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                  <td className="px-6 py-2 text-right text-xs text-ink/50">{m.by ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
