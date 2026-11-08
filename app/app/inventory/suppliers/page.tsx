"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnPrimary, input, Notice, type Msg } from "@/components/pharmacy/ui";

type Supplier = { id: string; name: string; phone: string | null; gstin: string | null; address: string | null; isActive: boolean };
const blank = { name: "", phone: "", gstin: "", address: "" };

export default function SuppliersPage() {
  const [list, setList] = useState<Supplier[] | null>(null);
  const [form, setForm] = useState(blank);
  const [edit, setEdit] = useState<(Supplier & { phone: string; gstin: string; address: string }) | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const r = await api<{ suppliers: Supplier[] }>("/api/inventory/suppliers");
    if (r.ok) setList(r.data.suppliers); else setMsg({ ok: false, text: r.error });
  }, []);
  useEffect(() => {
    api<{ suppliers: Supplier[] }>("/api/inventory/suppliers").then((r) => { if (r.ok) setList(r.data.suppliers); });
  }, []);

  async function save(p: Promise<{ ok: boolean; error?: string }>, ok: string, done?: () => void) {
    const r = await p;
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Something went wrong" });
    setMsg({ ok: true, text: ok });
    done?.();
    await load();
  }
  const clean = (v: { name: string; phone: string; gstin: string; address: string }) => ({ name: v.name, phone: v.phone || null, gstin: v.gstin || null, address: v.address || null });

  return (
    <div className="space-y-6">
      <Link href="/app/inventory" className="text-sm text-forest hover:underline">← Inventory</Link>
      <div><h1 className="font-display text-3xl">Suppliers</h1><p className="mt-1 text-sm text-ink/60">Who you buy stock from. Pick one when you receive stock.</p></div>
      <Notice msg={msg} />
      <Card>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void save(api("/api/inventory/suppliers", "POST", { name: form.name, phone: form.phone, gstin: form.gstin, address: form.address }), "Supplier added", () => setForm(blank)); }}>
          <div><label className="text-xs text-ink/60">Name*</label><input required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 block w-56 ${input}`} /></div>
          <div><label className="text-xs text-ink/60">Phone</label><input maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`mt-1 block w-36 ${input}`} /></div>
          <div><label className="text-xs text-ink/60">GSTIN</label><input maxLength={20} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className={`mt-1 block w-44 ${input}`} /></div>
          <div><label className="text-xs text-ink/60">Address</label><input maxLength={300} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`mt-1 block w-64 ${input}`} /></div>
          <button className={btnPrimary}>Add supplier</button>
        </form>
      </Card>
      {list && list.length === 0 && <Card><p className="text-sm text-ink/70">No suppliers yet.</p></Card>}
      {list && list.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={`border-b border-sand/60 last:border-0 ${s.isActive ? "" : "opacity-50"}`}>
                  {edit?.id === s.id ? (
                    <td className="px-6 py-3" colSpan={2}>
                      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void save(api(`/api/inventory/suppliers/${s.id}`, "PATCH", clean(edit)), "Saved", () => setEdit(null)); }}>
                        <input aria-label="Name" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={`w-52 ${input}`} />
                        <input aria-label="Phone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className={`w-36 ${input}`} />
                        <input aria-label="GSTIN" value={edit.gstin} onChange={(e) => setEdit({ ...edit, gstin: e.target.value })} className={`w-44 ${input}`} />
                        <input aria-label="Address" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} className={`w-60 ${input}`} />
                        <button className="text-forest hover:underline">Save</button>
                        <button type="button" onClick={() => setEdit(null)} className="text-ink/50">Cancel</button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-6 py-3">{s.name}{!s.isActive && <span className="ml-2 text-xs text-ink/50">(inactive)</span>}
                        <p className="text-xs text-ink/50">{[s.phone, s.gstin, s.address].filter(Boolean).join(" · ")}</p></td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => setEdit({ ...s, phone: s.phone ?? "", gstin: s.gstin ?? "", address: s.address ?? "" })} className="text-forest hover:underline">Edit</button>
                        <button onClick={() => save(api(`/api/inventory/suppliers/${s.id}`, "PATCH", { isActive: !s.isActive }), s.isActive ? "Deactivated" : "Activated")} className="ml-3 text-ink/60 hover:underline">{s.isActive ? "Deactivate" : "Activate"}</button>
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
