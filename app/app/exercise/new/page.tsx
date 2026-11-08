"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, input, Notice, type Msg, type Template } from "@/components/exercise/ui";
import { prescriptionText } from "@/lib/exercise/logic";

type Patient = { id: string; name: string; uhid: string | null; phone: string };
type Line = { key: number; templateId?: string; name: string; sets: string; reps: string; holdSeconds: string; frequency: string; instructions: string };

export default function NewExercisePlan() {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ templates: Template[] }>("/api/exercise/templates?active=1").then((r) => { if (r.ok) setTemplates(r.data.templates); else setMsg({ ok: false, text: r.error }); }); }, []);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => api<{ patients: Patient[] }>(`/api/patients?q=${encodeURIComponent(q.trim())}`).then((r) => { if (r.ok) setFound(r.data.patients.slice(0, 6)); }), 250);
    return () => clearTimeout(t);
  }, [q]);

  const shown = useMemo(() => (templates ?? []).filter((t) => !filter.trim() || `${t.name} ${t.category}`.toLowerCase().includes(filter.trim().toLowerCase())), [templates, filter]);
  const num = (s: string) => (s.trim() ? Number(s) : null);
  const add = (t?: Template) => setLines((ls) => [...ls, { key: Date.now() + ls.length, templateId: t?.id, name: t?.name ?? "", sets: t?.sets?.toString() ?? "", reps: t?.reps?.toString() ?? "", holdSeconds: t?.holdSeconds?.toString() ?? "", frequency: "", instructions: t?.instructions ?? "" }]);
  const patch = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  async function save() {
    if (!patient) return setMsg({ ok: false, text: "Choose a patient first" });
    setBusy(true);
    const r = await api<{ id: string }>("/api/exercise/plans", "POST", {
      patientId: patient.id, title, notes,
      items: lines.map((l) => ({ templateId: l.templateId, name: l.name, sets: num(l.sets), reps: num(l.reps), holdSeconds: num(l.holdSeconds), frequency: l.frequency, instructions: l.instructions })),
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    router.push(`/app/exercise/${r.data.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">New exercise plan</h1>
      <Card className="space-y-4">
        {!patient ? (
          <div>
            <label className="text-xs text-ink/60" htmlFor="pp">Find patient (name, phone or UHID)</label>
            <input id="pp" className={`mt-1 w-full ${input}`} value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setFound([]); }} />
            {q.trim().length >= 2 && (found.length === 0 ? <p className="mt-2 text-sm text-ink/50">No patient found.</p> : (
              <ul className="mt-2 divide-y divide-sand/60 text-sm">
                {found.map((p) => <li key={p.id}><button type="button" onClick={() => setPatient(p)} className="w-full py-2 text-left hover:text-forest">{p.name} <span className="font-data text-xs text-ink/50">{p.uhid} · {p.phone}</span></button></li>)}
              </ul>
            ))}
          </div>
        ) : (
          <p className="text-sm"><span className="font-medium">{patient.name}</span> <span className="font-data text-xs text-ink/50">{patient.uhid}</span>
            <button type="button" onClick={() => setPatient(null)} className="ml-3 text-xs text-forest hover:underline">Change</button></p>
        )}
        <input className={`w-full ${input}`} placeholder="Plan title, e.g. Knee rehab phase 1 *" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={`w-full ${input}`} rows={2} placeholder="Notes for the patient (optional)" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Exercises ({lines.length})</h2>
          <button className={btnGhost} onClick={() => add()}>Add custom exercise</button>
        </div>
        {lines.length === 0 && <p className="text-sm text-ink/60">Pick exercises from the library below, or add a custom one.</p>}
        {lines.map((l) => (
          <div key={l.key} className="space-y-2 rounded-xl border border-sand/70 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
              <input className={`col-span-2 sm:col-span-5 ${input}`} placeholder="Exercise name *" value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })} aria-label="Exercise name" />
              <input className={`sm:col-span-1 ${input}`} placeholder="Sets" inputMode="numeric" value={l.sets} onChange={(e) => patch(l.key, { sets: e.target.value })} aria-label="Sets" />
              <input className={`sm:col-span-1 ${input}`} placeholder="Reps" inputMode="numeric" value={l.reps} onChange={(e) => patch(l.key, { reps: e.target.value })} aria-label="Reps" />
              <input className={`sm:col-span-2 ${input}`} placeholder="Hold (s)" inputMode="numeric" value={l.holdSeconds} onChange={(e) => patch(l.key, { holdSeconds: e.target.value })} aria-label="Hold seconds" />
              <input className={`sm:col-span-2 ${input}`} placeholder="e.g. twice daily" value={l.frequency} onChange={(e) => patch(l.key, { frequency: e.target.value })} aria-label="Frequency" />
              <button className="text-sm text-clay sm:col-span-1" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remove</button>
            </div>
            <textarea className={`w-full ${input}`} rows={2} placeholder="Instructions" value={l.instructions} onChange={(e) => patch(l.key, { instructions: e.target.value })} aria-label="Instructions" />
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Library</h2>
          <input className={`w-56 ${input}`} placeholder="Filter exercises" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter library" />
        </div>
        {templates === null ? <p className="text-sm text-ink/50">Loading...</p> : templates.length === 0 ? (
          <p className="text-sm text-ink/60">The library is empty. Load the starter set from the Exercise library page, or add custom exercises above.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {shown.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-2 rounded-xl border border-sand/70 p-3 text-sm">
                <span><span className="font-medium">{t.name}</span> <span className="text-xs text-ink/50">{t.category}</span><br /><span className="text-xs text-ink/60">{prescriptionText({ ...t, frequency: null })}</span></span>
                <button className="text-forest hover:underline" onClick={() => add(t)}>Add</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Notice msg={msg} />
      <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? "Creating..." : "Create plan"}</button>
    </div>
  );
}
