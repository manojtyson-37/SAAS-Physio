"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, input, Notice, useCanPrescribe, type Msg, type Template } from "@/components/exercise/ui";

type Form = { name: string; category: string; description: string; sets: string; reps: string; holdSeconds: string; instructions: string };
const blank: Form = { name: "", category: "General", description: "", sets: "", reps: "", holdSeconds: "", instructions: "" };
const num = (s: string) => (s.trim() ? Number(s) : null);

export default function LibraryPage() {
  const canWrite = useCanPrescribe();
  const [rows, setRows] = useState<Template[] | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ templates: Template[] }>("/api/exercise/templates").then((r) => { if (r.ok) setRows(r.data.templates); else setMsg({ ok: false, text: r.error }); }), []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form) return;
    setBusy(true);
    const body = { name: form.name, category: form.category, description: form.description, sets: num(form.sets), reps: num(form.reps), holdSeconds: num(form.holdSeconds), instructions: form.instructions };
    const r = editing ? await api(`/api/exercise/templates/${editing}`, "PATCH", body) : await api("/api/exercise/templates", "POST", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: editing ? "Exercise updated." : "Exercise added." });
    setForm(null); setEditing(null); load();
  }

  async function act(p: Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, ok: string) {
    const r = await p;
    setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: r.error });
    if (r.ok) load();
  }

  const shown = (rows ?? []).filter((t) => !q.trim() || `${t.name} ${t.category}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/exercise" className="text-xs text-forest hover:underline">Exercise plans</Link>
          <h1 className="font-display text-3xl">Exercise library</h1>
          <p className="mt-1 text-sm text-ink/60">Templates copied into plans. Editing a template never changes plans already issued.</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button className={btnGhost} onClick={async () => { const r = await api<{ added: number; skipped: number }>("/api/exercise/templates/defaults", "POST"); setMsg(r.ok ? { ok: true, text: r.data.added ? `Added ${r.data.added} starter exercises.` : "Starter exercises are already in your library." } : { ok: false, text: r.error }); if (r.ok) load(); }}>Load starter exercises</button>
            <button className={btnPrimary} onClick={() => { setEditing(null); setForm(blank); }}>New exercise</button>
          </div>
        )}
      </div>
      <Notice msg={msg} />

      {form && (
        <Card className="space-y-3">
          <h2 className="font-display text-xl">{editing ? "Edit exercise" : "New exercise"}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
            <input className={`col-span-2 sm:col-span-5 ${input}`} placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" />
            <input className={`col-span-2 sm:col-span-3 ${input}`} placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category" />
            <input className={`sm:col-span-1 ${input}`} placeholder="Sets" inputMode="numeric" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} aria-label="Sets" />
            <input className={`sm:col-span-1 ${input}`} placeholder="Reps" inputMode="numeric" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} aria-label="Reps" />
            <input className={`sm:col-span-2 ${input}`} placeholder="Hold (s)" inputMode="numeric" value={form.holdSeconds} onChange={(e) => setForm({ ...form, holdSeconds: e.target.value })} aria-label="Hold seconds" />
          </div>
          <input className={`w-full ${input}`} placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="Description" />
          <textarea className={`w-full ${input}`} rows={3} placeholder="Patient instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} aria-label="Instructions" />
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? "Saving..." : "Save"}</button>
            <button className={btnGhost} onClick={() => { setForm(null); setEditing(null); }}>Cancel</button>
          </div>
        </Card>
      )}

      <input className={`w-64 ${input}`} placeholder="Filter by name or category" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter" />
      {rows === null ? <p className="text-sm text-ink/50">Loading...</p> : rows.length === 0 ? (
        <Card><p className="text-sm text-ink/60">No exercises yet.{canWrite ? " Load the starter set of common rehab exercises, or add your own." : ""}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs text-ink/50"><th className="px-6 py-3">Exercise</th><th>Category</th><th>Sets</th><th>Reps</th><th>Hold</th><th>Active</th><th /></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className={`border-b border-sand/60 last:border-0 ${t.isActive ? "" : "opacity-50"}`}>
                  <td className="px-6 py-3">{t.name}</td><td className="text-ink/60">{t.category}</td>
                  <td className="font-data">{t.sets ?? "-"}</td><td className="font-data">{t.reps ?? "-"}</td><td className="font-data">{t.holdSeconds ? `${t.holdSeconds}s` : "-"}</td>
                  <td>{t.isActive ? "Yes" : "No"}</td>
                  <td className="space-x-3 px-6 text-right">
                    {canWrite && (<>
                      <button className="text-forest hover:underline" onClick={() => { setEditing(t.id); setForm({ name: t.name, category: t.category, description: t.description ?? "", sets: t.sets?.toString() ?? "", reps: t.reps?.toString() ?? "", holdSeconds: t.holdSeconds?.toString() ?? "", instructions: t.instructions ?? "" }); }}>Edit</button>
                      <button className="text-forest hover:underline" onClick={() => act(api(`/api/exercise/templates/${t.id}`, "PATCH", { isActive: !t.isActive }), t.isActive ? "Deactivated." : "Activated.")}>{t.isActive ? "Deactivate" : "Activate"}</button>
                      <button className="text-clay hover:underline" onClick={() => { if (window.confirm(`Remove "${t.name}" from the library? Existing plans keep their copy.`)) act(api(`/api/exercise/templates/${t.id}`, "DELETE"), "Removed."); }}>Remove</button>
                    </>)}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="px-6 py-4 text-ink/60">Nothing matches that filter.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
