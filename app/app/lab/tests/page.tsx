"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";

type Test = { id: string; name: string; category: string; sampleType: string | null; unit: string | null; refLow: number | null; refHigh: number | null; refText: string | null; price: number; gstPercent: number; isActive: boolean; range: string };
type Form = { name: string; category: string; sampleType: string; unit: string; refLow: string; refHigh: string; refText: string; price: string; gstPercent: string };
const EMPTY: Form = { name: "", category: "Biochemistry", sampleType: "", unit: "", refLow: "", refHigh: "", refText: "", price: "", gstPercent: "0" };
const toForm = (t: Test): Form => ({ name: t.name, category: t.category, sampleType: t.sampleType ?? "", unit: t.unit ?? "", refLow: t.refLow?.toString() ?? "", refHigh: t.refHigh?.toString() ?? "", refText: t.refText ?? "", price: String(t.price), gstPercent: String(t.gstPercent) });

export default function LabTestsPage() {
  const [tests, setTests] = useState<Test[] | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ tests: Test[] }>("/api/lab/tests?inactive=1").then((r) => (r.ok ? setTests(r.data.tests) : (setTests([]), setMsg({ ok: false, text: r.error }))));
  useEffect(() => { void load(); }, []);

  const body = (f: Form) => ({
    name: f.name, category: f.category, price: f.price, gstPercent: f.gstPercent,
    sampleType: f.sampleType || null, unit: f.unit || null, refText: f.refText || null,
    refLow: f.refLow === "" ? null : f.refLow, refHigh: f.refHigh === "" ? null : f.refHigh,
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = editing === "new" ? await api("/api/lab/tests", "POST", body(form)) : await api(`/api/lab/tests/${editing}`, "PATCH", body(form));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: editing === "new" ? "Test added" : "Test updated" });
    setEditing(null);
    await load();
  }
  async function toggle(t: Test) {
    const r = await api(`/api/lab/tests/${t.id}`, "PATCH", { isActive: !t.isActive });
    setMsg(r.ok ? null : { ok: false, text: r.error });
    await load();
  }
  async function starter() {
    const r = await api<{ added: number }>("/api/lab/tests/defaults", "POST");
    setMsg(r.ok ? { ok: true, text: r.data.added ? `Added ${r.data.added} common tests` : "All starter tests are already in your catalogue" } : { ok: false, text: r.error });
    await load();
  }
  const f = (k: keyof Form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });
  const shown = (tests ?? []).filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()) || t.category.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/lab" className="text-sm text-forest hover:underline">Back to laboratory</Link>
          <h1 className="mt-2 font-display text-3xl">Test catalogue</h1>
          <p className="mt-1 text-sm text-ink/60">Prices and ranges here apply to new orders. Orders already issued keep the values they were created with.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={starter} className={btnGhost}>Add common tests</button>
          <button onClick={() => { setForm(EMPTY); setEditing("new"); }} className={btnPrimary}>Add test</button>
        </div>
      </div>
      <Notice msg={msg} />
      {editing && (
        <Card>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
            <input {...f("name")} required minLength={2} placeholder="Test name" aria-label="Test name" className={`${input} sm:col-span-2`} />
            <input {...f("category")} required placeholder="Category" aria-label="Category" className={input} />
            <input {...f("sampleType")} placeholder="Sample (Serum, Urine...)" aria-label="Sample type" className={input} />
            <input {...f("unit")} placeholder="Unit" aria-label="Unit" className={input} />
            <input {...f("price")} required type="number" min="0.01" step="0.01" placeholder="Price" aria-label="Price" className={input} />
            <input {...f("refLow")} type="number" step="any" placeholder="Range low" aria-label="Range low" className={input} />
            <input {...f("refHigh")} type="number" step="any" placeholder="Range high" aria-label="Range high" className={input} />
            <input {...f("refText")} placeholder="Text range (e.g. Negative)" aria-label="Text range" className={input} />
            <input {...f("gstPercent")} type="number" min="0" max="28" step="0.01" placeholder="GST %" aria-label="GST percent" className={input} />
            <div className="flex gap-2 sm:col-span-3">
              <button disabled={busy} className={btnPrimary}>{editing === "new" ? "Add" : "Save"}</button>
              <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
            </div>
          </form>
        </Card>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests or categories" aria-label="Search tests" className={`${input} w-72`} />
      {tests === null ? <Card><p className="text-sm text-ink/60">Loading...</p></Card> : shown.length === 0 ? (
        <Card><p className="text-sm text-ink/60">{tests.length === 0 ? "No tests yet. Use Add common tests to load a starter set of about 30 tests, then adjust prices." : "No test matches."}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-ink/50"><th className="px-4 py-3">Test</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Range</th><th className="px-4 py-3">Price</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className={`border-b border-sand/60 last:border-0 ${t.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2">{t.name}{!t.isActive && <span className="ml-2 text-xs">(off)</span>}</td>
                  <td className="px-4 py-2 text-ink/60">{t.category}</td>
                  <td className="px-4 py-2 text-ink/60">{t.unit}</td>
                  <td className="px-4 py-2 font-data text-xs">{t.range}</td>
                  <td className="px-4 py-2 font-data">{inr(t.price)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => { setForm(toForm(t)); setEditing(t.id); }} className="text-forest hover:underline">Edit</button>
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
