"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, input, Notice, paise, PlanBadge, PLAN_LABEL, useCanWriteClinical, type Msg } from "@/components/dental/ui";

type Row = { id: string; title: string; status: string; createdAt: string; itemCount: number; patient: { id: string; name: string; uhid: string | null }; totals: { planned: number; done: number } };
type Patient = { id: string; name: string; uhid: string | null; phone: string };
type Draft = { tooth: string; procedure: string; price: string; gstPercent: string };
const blank = (): Draft => ({ tooth: "", procedure: "", price: "", gstPercent: "0" });

function CreatePlan({ onClose, presetPatient }: { onClose: () => void; presetPatient?: Patient | null }) {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(presetPatient ?? null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Patient[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Draft[]>([blank()]);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => api<{ patients: Patient[] }>(`/api/patients?q=${encodeURIComponent(q.trim())}`).then((r) => { if (r.ok) setFound(r.data.patients.slice(0, 6)); }), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function save() {
    if (!patient) return setMsg({ ok: false, text: "Choose a patient first" });
    const items = rows.filter((r) => r.procedure.trim() || r.price).map((r) => ({ tooth: r.tooth ? Number(r.tooth) : null, procedure: r.procedure, price: r.price, gstPercent: r.gstPercent || 0 }));
    setBusy(true);
    const r = await api<{ id: string }>("/api/dental/plans", "POST", { patientId: patient.id, title, notes, items });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    router.push(`/app/dental/${r.data.id}`);
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-xl">New treatment plan</h2>
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
      <input className={`w-full ${input}`} placeholder="Plan title, e.g. Upper right restoration *" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="space-y-2">
        <p className="text-xs text-ink/60">Procedures (you can add more later)</p>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-12">
            <input className={`sm:col-span-2 ${input}`} placeholder="Tooth" inputMode="numeric" value={r.tooth} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, tooth: e.target.value } : x)))} />
            <input className={`col-span-2 sm:col-span-5 ${input}`} placeholder="Procedure" value={r.procedure} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, procedure: e.target.value } : x)))} />
            <input className={`sm:col-span-2 ${input}`} placeholder="Price" inputMode="decimal" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
            <input className={`sm:col-span-2 ${input}`} placeholder="GST %" inputMode="decimal" value={r.gstPercent} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, gstPercent: e.target.value } : x)))} />
            <button type="button" aria-label="Remove row" className="text-sm text-clay sm:col-span-1" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [blank()])}>Remove</button>
          </div>
        ))}
        <button type="button" className="text-sm text-forest hover:underline" onClick={() => setRows([...rows, blank()])}>+ Add procedure</button>
      </div>
      <textarea className={`w-full ${input}`} rows={2} placeholder="Notes (optional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Notice msg={msg} />
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? "Creating..." : "Create plan"}</button>
        <button className={btnGhost} onClick={onClose}>Cancel</button>
      </div>
    </Card>
  );
}

export default function DentalPlansPage() {
  const canWrite = useCanWriteClinical();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [preset, setPreset] = useState<Patient | null>(null);

  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("patientId");
    setTimeout(() => setPatientId(pid), 0);
  }, []);
  useEffect(() => {
    if (!patientId) return;
    api<{ patient: Patient }>(`/api/dental/chart/${patientId}`).then((r) => { if (r.ok) setPreset({ ...r.data.patient, phone: "" }); });
  }, [patientId]);

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (q.trim()) p.set("q", q.trim());
      if (patientId) p.set("patientId", patientId);
      api<{ plans: Row[] }>(`/api/dental/plans?${p}`).then((r) => { if (r.ok) { setRows(r.data.plans); setError(null); } else setError(r.error); });
    }, 200);
    return () => clearTimeout(t);
  }, [status, q, patientId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Treatment plans</h1>
          <p className="mt-1 text-sm text-ink/60">Quote, track and bill dental treatment.{preset ? ` Showing plans for ${preset.name}.` : ""}</p>
        </div>
        {canWrite && !creating && <button className={btnPrimary} onClick={() => setCreating(true)}>New plan</button>}
      </div>
      {creating && <CreatePlan onClose={() => setCreating(false)} presetPatient={preset} />}
      <div className="flex flex-wrap gap-2">
        <input className={`w-64 ${input}`} placeholder="Search title, patient or UHID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search plans" />
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {patientId && <button className={btnGhost} onClick={() => { setPatientId(null); setPreset(null); window.history.replaceState(null, "", "/app/dental"); }}>Show all patients</button>}
      </div>
      <Notice msg={error ? { ok: false, text: error } : null} />
      {rows === null ? <p className="text-sm text-ink/50">Loading...</p> : rows.length === 0 ? (
        <Card><p className="text-sm text-ink/60">No treatment plans {status || q ? "match these filters" : "yet"}.{canWrite && !status && !q ? " Create the first one with New plan." : ""}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs text-ink/50"><th className="px-6 py-3">Plan</th><th>Patient</th><th>Procedures</th><th>Pending</th><th>Done</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3"><Link href={`/app/dental/${r.id}`} className="text-forest hover:underline">{r.title}</Link></td>
                  <td>{r.patient.name} <span className="font-data text-xs text-ink/50">{r.patient.uhid}</span></td>
                  <td>{r.itemCount}</td>
                  <td className="font-data">{paise(r.totals.planned)}</td>
                  <td className="font-data">{paise(r.totals.done)}</td>
                  <td><PlanBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
