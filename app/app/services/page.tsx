"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { inr } from "@/components/billing/InvoiceForm";

type Service = { id: string; name: string; category: string; price: number; gstPercent: number; isActive: boolean };
const CATEGORIES = ["Consultation", "Procedure", "Therapy", "Lab", "Radiology", "Pharmacy", "Other"];
const input = "rounded-lg border border-sand px-3 py-2 text-sm";

export default function ServicesPage() {
  const [items, setItems] = useState<Service[] | null>(null);
  const [form, setForm] = useState({ name: "", category: "Consultation", price: "", gstPercent: "0" });
  const [edit, setEdit] = useState<{ id: string; price: string; gstPercent: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/services?all=1");
    if (res.status === 403) return setDenied(true);
    setItems((await res.json()).services);
  }, []);
  useEffect(() => {
    fetch("/api/services?all=1")
      .then(async (res) => (res.status === 403 ? setDenied(true) : setItems((await res.json()).services)))
      .catch(() => setMsg({ ok: false, text: "Could not load the price list" }));
  }, []);

  async function call(url: string, method: string, body?: unknown, okText?: string) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: data.error ?? "Something went wrong" }); return false; }
    if (okText) setMsg({ ok: true, text: okText });
    await load();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/services", "POST", form, "Service added")) setForm({ name: "", category: "Consultation", price: "", gstPercent: "0" });
  }

  if (denied) return <p className="text-sm text-ink/60">Only the clinic admin manages the price list.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Price list</h1>
        <p className="mt-1 text-sm text-ink/60">Services you can add to a bill in one click. Changing a price never alters bills already issued.</p>
      </div>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-forest/10 text-forest" : "bg-clay-light text-clay"}`}>{msg.text}</p>}

      <Card>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs text-ink/60">Name*</label>
            <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 block w-60 ${input}`} /></div>
          <div><label className="text-xs text-ink/60">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`mt-1 block ${input}`}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-ink/60">Price ₹*</label>
            <input required type="number" min={0.01} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`mt-1 block w-28 ${input}`} /></div>
          <div><label className="text-xs text-ink/60">GST %</label>
            <input type="number" min={0} max={28} step="0.01" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} className={`mt-1 block w-20 ${input}`} /></div>
          <button className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">Add service</button>
        </form>
      </Card>

      {items && items.length === 0 && (
        <Card>
          <p className="text-sm text-ink/70">Your price list is empty.</p>
          <button onClick={() => call("/api/services/defaults", "POST", undefined, "Starter list loaded")} className="mt-3 rounded-lg border border-forest px-4 py-2 text-sm text-forest hover:bg-forest/5">
            Load a starter list
          </button>
          <p className="mt-2 text-xs text-ink/50">Starter prices are examples with GST 0% (healthcare services are generally exempt); edit them to match your clinic and check GST treatment with your accountant.</p>
        </Card>
      )}

      {items && items.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
                <th className="px-6 py-3">Service</th><th className="px-6 py-3">Category</th><th className="px-6 py-3">Price</th><th className="px-6 py-3">GST</th><th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className={`border-b border-sand/60 last:border-0 ${s.isActive ? "" : "opacity-50"}`}>
                  <td className="px-6 py-3">{s.name}{!s.isActive && <span className="ml-2 text-xs text-ink/50">(inactive)</span>}</td>
                  <td className="px-6 py-3 text-ink/70">{s.category}</td>
                  {edit?.id === s.id ? (
                    <>
                      <td className="px-6 py-2"><input aria-label="Price" type="number" min={0.01} step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} className={`w-24 ${input}`} /></td>
                      <td className="px-6 py-2"><input aria-label="GST percent" type="number" min={0} max={28} step="0.01" value={edit.gstPercent} onChange={(e) => setEdit({ ...edit, gstPercent: e.target.value })} className={`w-20 ${input}`} /></td>
                      <td className="px-6 py-2 text-right">
                        <button onClick={async () => { if (await call(`/api/services/${s.id}`, "PATCH", { price: edit.price, gstPercent: edit.gstPercent }, "Saved")) setEdit(null); }} className="text-forest hover:underline">Save</button>
                        <button onClick={() => setEdit(null)} className="ml-3 text-ink/50">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 font-data">{inr(s.price)}</td>
                      <td className="px-6 py-3 font-data">{s.gstPercent}%</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => setEdit({ id: s.id, price: String(s.price), gstPercent: String(s.gstPercent) })} className="text-forest hover:underline">Edit</button>
                        <button onClick={() => call(`/api/services/${s.id}`, "PATCH", { isActive: !s.isActive })} className="ml-3 text-ink/60 hover:underline">{s.isActive ? "Deactivate" : "Activate"}</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
