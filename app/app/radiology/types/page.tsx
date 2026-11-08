"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";
import { MODALITIES, MODALITY_LABEL, type Modality } from "@/lib/radiology/logic";

type Type = { id: string; modality: Modality; name: string; bodyPart: string | null; price: number; gstPercent: number; isActive: boolean };
type Form = { modality: string; name: string; bodyPart: string; price: string; gstPercent: string };
const EMPTY: Form = { modality: "XRAY", name: "", bodyPart: "", price: "", gstPercent: "0" };

export default function StudyTypesPage() {
  const [types, setTypes] = useState<Type[] | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ types: Type[] }>("/api/radiology/types?inactive=1").then((r) => (r.ok ? setTypes(r.data.types) : (setTypes([]), setMsg({ ok: false, text: r.error }))));
  useEffect(() => { void load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = { modality: form.modality, name: form.name, bodyPart: form.bodyPart || null, price: form.price, gstPercent: form.gstPercent };
    const r = editing === "new" ? await api("/api/radiology/types", "POST", payload) : await api(`/api/radiology/types/${editing}`, "PATCH", payload);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: editing === "new" ? "Study type added" : "Study type updated" });
    setEditing(null);
    await load();
  }
  async function toggle(t: Type) {
    const r = await api(`/api/radiology/types/${t.id}`, "PATCH", { isActive: !t.isActive });
    setMsg(r.ok ? null : { ok: false, text: r.error });
    await load();
  }
  async function starter() {
    const r = await api<{ added: number }>("/api/radiology/types/defaults", "POST");
    setMsg(r.ok ? { ok: true, text: r.data.added ? `Added ${r.data.added} common studies` : "All starter studies are already in your list" } : { ok: false, text: r.error });
    await load();
  }
  const shown = (types ?? []).filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()) || (t.bodyPart ?? "").toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/radiology" className="text-sm text-forest hover:underline">Back to radiology</Link>
          <h1 className="mt-2 font-display text-3xl">Study types</h1>
          <p className="mt-1 text-sm text-ink/60">Prices apply to new orders. Orders already issued keep the price they were created with.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={starter} className={btnGhost}>Add common studies</button>
          <button onClick={() => { setForm(EMPTY); setEditing("new"); }} className={btnPrimary}>Add study type</button>
        </div>
      </div>
      <Notice msg={msg} />
      {editing && (
        <Card>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
            <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })} aria-label="Modality" className={input}>
              {MODALITIES.map((m) => <option key={m} value={m}>{MODALITY_LABEL[m]}</option>)}
            </select>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} placeholder="Study name" aria-label="Study name" className={`${input} sm:col-span-2`} />
            <input value={form.bodyPart} onChange={(e) => setForm({ ...form, bodyPart: e.target.value })} placeholder="Body part" aria-label="Body part" className={input} />
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required type="number" min="0.01" step="0.01" placeholder="Price" aria-label="Price" className={input} />
            <input value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} type="number" min="0" max="28" step="0.01" placeholder="GST %" aria-label="GST percent" className={input} />
            <div className="flex gap-2 sm:col-span-3">
              <button disabled={busy} className={btnPrimary}>{editing === "new" ? "Add" : "Save"}</button>
              <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
            </div>
          </form>
        </Card>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search studies" aria-label="Search studies" className={`${input} w-72`} />
      {types === null ? <Card><p className="text-sm text-ink/60">Loading...</p></Card> : shown.length === 0 ? (
        <Card><p className="text-sm text-ink/60">{types.length === 0 ? "No study types yet. Use Add common studies to load X-ray, ultrasound, CT, MRI and ECG, then adjust prices." : "No study matches."}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-ink/50"><th className="px-4 py-3">Study</th><th className="px-4 py-3">Modality</th><th className="px-4 py-3">Body part</th><th className="px-4 py-3">Price</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className={`border-b border-sand/60 last:border-0 ${t.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2">{t.name}{!t.isActive && <span className="ml-2 text-xs">(off)</span>}</td>
                  <td className="px-4 py-2 text-ink/60">{MODALITY_LABEL[t.modality] ?? t.modality}</td>
                  <td className="px-4 py-2 text-ink/60">{t.bodyPart}</td>
                  <td className="px-4 py-2 font-data">{inr(t.price)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => { setForm({ modality: t.modality, name: t.name, bodyPart: t.bodyPart ?? "", price: String(t.price), gstPercent: String(t.gstPercent) }); setEditing(t.id); }} className="text-forest hover:underline">Edit</button>
                    <button onClick={() => toggle(t)} className="ml-3 text-forest hover:underline">{t.isActive ? "Turn off" : "Turn on"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
