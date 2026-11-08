"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, fmtDate, input, Notice, StatusBadge, useCanLog, useCanPrescribe, type Msg, type Template } from "@/components/exercise/ui";
import { chartRows, prescriptionText, progressSummary } from "@/lib/exercise/logic";

type Item = { id: string; templateId: string | null; name: string; sets: number | null; reps: number | null; holdSeconds: number | null; frequency: string | null; instructions: string | null };
type Prog = { id: string; recordedAt: string; painScore: number | null; adherencePercent: number | null; notes: string | null };
type Plan = {
  id: string; title: string; status: "ACTIVE" | "COMPLETED" | "CANCELLED"; startDate: string; endDate: string | null; notes: string | null; doctor: string | null;
  patient: { id: string; name: string; uhid: string | null }; items: Item[]; progress: Prog[];
};
type ItemForm = { name: string; sets: string; reps: string; holdSeconds: string; frequency: string; instructions: string };
const num = (s: string) => (s.trim() ? Number(s) : null);

export default function ExercisePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canPrescribe = useCanPrescribe();
  const canLog = useCanLog();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pick, setPick] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [pf, setPf] = useState({ pain: "", adherence: "", notes: "" });
  const [editProg, setEditProg] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);

  const load = useCallback(() => api<{ plan: Plan }>(`/api/exercise/plans/${id}`).then((r) => { if (r.ok) setPlan(r.data.plan); else setErr(r.error); }), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<{ templates: Template[] }>("/api/exercise/templates?active=1").then((r) => { if (r.ok) setTemplates(r.data.templates); }); }, []);
  useEffect(() => { const t = setTimeout(() => setChartReady(true), 0); return () => clearTimeout(t); }, []);

  const summary = useMemo(() => progressSummary(plan?.progress ?? []), [plan]);
  const rows = useMemo(() => chartRows(plan?.progress ?? []), [plan]);

  async function run(p: Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, ok?: string) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return false; }
    if (ok) setMsg({ ok: true, text: ok });
    await load();
    return true;
  }

  if (err) return <div className="space-y-3"><Notice msg={{ ok: false, text: err }} /><Link href="/app/exercise" className="text-sm text-forest hover:underline">Back to plans</Link></div>;
  if (!plan) return <p className="text-sm text-ink/50">Loading...</p>;
  const active = plan.status === "ACTIVE";

  async function move(idx: number, dir: -1 | 1) {
    const order = plan!.items.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    await run(api(`/api/exercise/plans/${id}/items`, "PUT", { order }));
  }

  async function saveItem() {
    if (!form || !editing) return;
    const ok = await run(api(`/api/exercise/plans/${id}/items/${editing}`, "PATCH", { name: form.name, sets: num(form.sets), reps: num(form.reps), holdSeconds: num(form.holdSeconds), frequency: form.frequency, instructions: form.instructions }), "Exercise updated.");
    if (ok) { setEditing(null); setForm(null); }
  }

  async function saveProgress() {
    const body = { painScore: pf.pain.trim() ? Number(pf.pain) : null, adherencePercent: pf.adherence.trim() ? Number(pf.adherence) : null, notes: pf.notes };
    const ok = editProg
      ? await run(api(`/api/exercise/plans/${id}/progress`, "PATCH", { progressId: editProg, ...body }), "Entry corrected.")
      : await run(api(`/api/exercise/plans/${id}/progress`, "POST", body), "Check-in saved.");
    if (ok) { setPf({ pain: "", adherence: "", notes: "" }); setEditProg(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/exercise" className="text-xs text-forest hover:underline">Exercise plans</Link>
          <h1 className="font-display text-3xl">{plan.title}</h1>
          <p className="mt-1 text-sm text-ink/60">{plan.patient.name} <span className="font-data text-xs text-ink/50">{plan.patient.uhid}</span> · from {fmtDate(plan.startDate)}{plan.endDate ? ` to ${fmtDate(plan.endDate)}` : ""} · <StatusBadge status={plan.status} /></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/exercise/${id}/print`} className={btnGhost}>Patient handout</Link>
          {canPrescribe && active && (<>
            <button className={btnPrimary} disabled={busy} onClick={() => run(api(`/api/exercise/plans/${id}`, "PATCH", { status: "COMPLETED" }), "Plan completed.")}>Mark completed</button>
            <button className={btnGhost} disabled={busy} onClick={() => { if (window.confirm("Cancel this plan?")) run(api(`/api/exercise/plans/${id}`, "PATCH", { status: "CANCELLED" }), "Plan cancelled."); }}>Cancel plan</button>
          </>)}
        </div>
      </div>
      <Notice msg={msg} />

      <Card className="overflow-x-auto p-0">
        <h2 className="px-6 pt-5 font-display text-xl">Exercises</h2>
        {plan.items.length === 0 ? <p className="px-6 py-4 text-sm text-ink/60">No exercises yet.{canPrescribe && active ? " Add one below." : ""}</p> : (
          <ol className="mt-2 divide-y divide-sand/60 text-sm">
            {plan.items.map((i, idx) => (
              <li key={i.id} className="px-6 py-3">
                {editing === i.id && form ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                      <input className={`col-span-2 sm:col-span-5 ${input}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Exercise name" />
                      <input className={`sm:col-span-1 ${input}`} placeholder="Sets" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} aria-label="Sets" />
                      <input className={`sm:col-span-1 ${input}`} placeholder="Reps" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} aria-label="Reps" />
                      <input className={`sm:col-span-2 ${input}`} placeholder="Hold (s)" value={form.holdSeconds} onChange={(e) => setForm({ ...form, holdSeconds: e.target.value })} aria-label="Hold seconds" />
                      <input className={`sm:col-span-3 ${input}`} placeholder="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} aria-label="Frequency" />
                    </div>
                    <textarea className={`w-full ${input}`} rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} aria-label="Instructions" />
                    <div className="flex gap-2"><button className={btnPrimary} disabled={busy} onClick={saveItem}>Save</button><button className={btnGhost} onClick={() => { setEditing(null); setForm(null); }}>Cancel</button></div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p><span className="font-data text-xs text-ink/40">{idx + 1}.</span> <span className="font-medium">{i.name}</span> <span className="text-ink/60">{prescriptionText(i)}</span></p>
                      {i.instructions && <p className="mt-0.5 text-xs text-ink/60">{i.instructions}</p>}
                    </div>
                    {canPrescribe && active && (
                      <div className="space-x-3 whitespace-nowrap">
                        <button aria-label="Move up" disabled={idx === 0 || busy} className="text-forest disabled:opacity-30" onClick={() => move(idx, -1)}>Up</button>
                        <button aria-label="Move down" disabled={idx === plan.items.length - 1 || busy} className="text-forest disabled:opacity-30" onClick={() => move(idx, 1)}>Down</button>
                        <button className="text-forest hover:underline" onClick={() => { setEditing(i.id); setForm({ name: i.name, sets: i.sets?.toString() ?? "", reps: i.reps?.toString() ?? "", holdSeconds: i.holdSeconds?.toString() ?? "", frequency: i.frequency ?? "", instructions: i.instructions ?? "" }); }}>Edit</button>
                        <button className="text-clay hover:underline" disabled={busy} onClick={() => run(api(`/api/exercise/plans/${id}/items/${i.id}`, "DELETE"), "Exercise removed.")}>Remove</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {canPrescribe && active && (
          <div className="flex flex-wrap items-center gap-2 border-t border-sand px-6 py-4">
            <select className={input} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Library exercise">
              <option value="">Add from library...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
            </select>
            <button className={btnPrimary} disabled={!pick || busy} onClick={async () => { if (await run(api(`/api/exercise/plans/${id}/items`, "POST", { templateId: pick }), "Exercise added.")) setPick(""); }}>Add</button>
            <button className={btnGhost} disabled={busy} onClick={async () => { const name = window.prompt("Custom exercise name"); if (name) await run(api(`/api/exercise/plans/${id}/items`, "POST", { name }), "Exercise added. Use Edit to set sets and reps."); }}>Add custom</button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-xl">Progress</h2>
        <div className="mt-2 flex flex-wrap gap-6 text-sm">
          <span>Check-ins <span className="font-data">{summary.entries}</span></span>
          <span>Avg adherence <span className="font-data">{summary.avgAdherence === null ? "-" : `${summary.avgAdherence}%`}</span></span>
          <span>Pain now <span className="font-data">{summary.latestPain === null ? "-" : `${summary.latestPain}/10`}</span></span>
          {summary.painChange !== null && <span>Change since first <span className="font-data">{summary.painChange > 0 ? "+" : ""}{summary.painChange}</span></span>}
        </div>
        {rows.length === 0 ? <p className="mt-4 text-sm text-ink/60">No check-ins yet. Log the first one below to start the chart.</p> : (
          <div className="mt-4 h-64 w-full" role="img" aria-label="Pain and adherence over time">
            {chartReady && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d5" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis yAxisId="pain" domain={[0, 10]} fontSize={12} width={32} />
                  <YAxis yAxisId="adh" orientation="right" domain={[0, 100]} fontSize={12} width={36} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="pain" type="monotone" dataKey="pain" name="Pain (0-10)" stroke="#b4532a" strokeWidth={2} connectNulls />
                  <Line yAxisId="adh" type="monotone" dataKey="adherence" name="Adherence %" stroke="#1f5c47" strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {canLog && (active || editProg) && (
          <div className="mt-5 space-y-2 border-t border-sand pt-4">
            <h3 className="text-sm font-medium">{editProg ? "Correct entry" : "Log check-in"}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
              <input className={`sm:col-span-2 ${input}`} placeholder="Pain 0-10" inputMode="numeric" value={pf.pain} onChange={(e) => setPf({ ...pf, pain: e.target.value })} aria-label="Pain score" />
              <input className={`sm:col-span-3 ${input}`} placeholder="Adherence 0-100 %" inputMode="numeric" value={pf.adherence} onChange={(e) => setPf({ ...pf, adherence: e.target.value })} aria-label="Adherence percent" />
              <input className={`col-span-2 sm:col-span-7 ${input}`} placeholder="Notes (optional)" maxLength={500} value={pf.notes} onChange={(e) => setPf({ ...pf, notes: e.target.value })} aria-label="Notes" />
            </div>
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy} onClick={saveProgress}>{editProg ? "Save correction" : "Save check-in"}</button>
              {editProg && <button className={btnGhost} onClick={() => { setEditProg(null); setPf({ pain: "", adherence: "", notes: "" }); }}>Cancel</button>}
            </div>
          </div>
        )}
        {plan.progress.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink/50"><th className="py-2">Date</th><th>Pain</th><th>Adherence</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {[...plan.progress].reverse().map((p) => (
                  <tr key={p.id} className="border-t border-sand/60">
                    <td className="py-2 text-ink/60">{fmtDate(p.recordedAt)}</td>
                    <td className="font-data">{p.painScore ?? "-"}</td>
                    <td className="font-data">{p.adherencePercent === null ? "-" : `${p.adherencePercent}%`}</td>
                    <td className="text-ink/70">{p.notes}</td>
                    <td className="text-right">{canLog && plan.status !== "CANCELLED" && <button className="text-forest hover:underline" onClick={() => { setEditProg(p.id); setPf({ pain: p.painScore?.toString() ?? "", adherence: p.adherencePercent?.toString() ?? "", notes: p.notes ?? "" }); }}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {plan.notes && <Card><p className="text-sm text-ink/70">{plan.notes}</p></Card>}
    </div>
  );
}
