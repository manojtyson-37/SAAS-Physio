"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import {
  ADULT_LOWER, ADULT_UPPER, CONDITIONS, CONDITION_STYLE, DECIDUOUS_LOWER, DECIDUOUS_UPPER, SURFACE_NAMES, SURFACE_ORDER,
  toothName, type Condition,
} from "@/lib/dental/fdi";
import { api, btnGhost, btnPrimary, fmtDateTime, input, Notice, useCanWriteClinical, type Msg } from "./ui";
import { useIsAdmin } from "@/components/ClinicContext";

type Rec = { id: string; tooth: number; condition: string; surfaces: string | null; notes: string | null; at: string; by: string | null };
type ChartData = { patient: { id: string; name: string; uhid: string | null }; teeth: Rec[]; history: Rec[] };

const styleOf = (c: string) => CONDITION_STYLE[(c as Condition) in CONDITION_STYLE ? (c as Condition) : "OTHER"];

function ToothButton({ n, rec, selected, onPick }: { n: number; rec?: Rec; selected: boolean; onPick: (n: number) => void }) {
  const s = rec ? styleOf(rec.condition) : null;
  const upper = [1, 2, 5, 6].includes(Math.floor(n / 10));
  return (
    <button
      type="button"
      onClick={() => onPick(n)}
      aria-label={`${toothName(n)}, tooth ${n}${rec ? `, ${s?.label}` : ", no findings"}`}
      aria-pressed={selected}
      title={`${n} ${toothName(n)}${rec ? ` - ${s?.label}${rec.surfaces ? ` (${rec.surfaces})` : ""}` : ""}`}
      className={`flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-lg p-0.5 sm:w-11 ${selected ? "ring-2 ring-forest" : "hover:bg-sand/60"}`}
    >
      {!upper && <span className="font-data text-[10px] text-ink/50">{n}</span>}
      <svg viewBox="0 0 32 40" className="h-9 w-7 sm:h-11 sm:w-9" aria-hidden>
        <path
          d="M6 6 Q16 -2 26 6 Q30 20 24 30 Q22 38 18 38 Q16 30 14 38 Q10 38 8 30 Q2 20 6 6 Z"
          fill={s?.fill ?? "#ffffff"} stroke={s?.stroke ?? "#9ca3af"} strokeWidth="1.6"
          strokeDasharray={rec && (rec.condition === "MISSING" || rec.condition === "EXTRACTED") ? "3 2" : undefined}
        />
        {rec?.surfaces && <text x="16" y="23" textAnchor="middle" fontSize="9" fontWeight="700" fill={s?.text}>{rec.surfaces}</text>}
        {rec && (rec.condition === "MISSING" || rec.condition === "EXTRACTED") && <path d="M8 10 L24 30 M24 10 L8 30" stroke={s?.stroke} strokeWidth="1.6" />}
      </svg>
      {upper && <span className="font-data text-[10px] text-ink/50">{n}</span>}
    </button>
  );
}

function Row({ teeth, state, sel, onPick }: { teeth: readonly number[]; state: Map<number, Rec>; sel: number | null; onPick: (n: number) => void }) {
  const half = teeth.length / 2;
  return (
    <div className="flex justify-center">
      <div className="flex border-r border-ink/20 pr-1">{teeth.slice(0, half).map((n) => <ToothButton key={n} n={n} rec={state.get(n)} selected={sel === n} onPick={onPick} />)}</div>
      <div className="flex pl-1">{teeth.slice(half).map((n) => <ToothButton key={n} n={n} rec={state.get(n)} selected={sel === n} onPick={onPick} />)}</div>
    </div>
  );
}

/** Interactive FDI chart. Adult 32 teeth by default, toggle to add the 20 primary teeth. */
export function ToothChart({ patientId }: { patientId: string }) {
  const isAdmin = useIsAdmin();
  const canWrite = useCanWriteClinical();
  const [data, setData] = useState<ChartData | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [showPrimary, setShowPrimary] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [cond, setCond] = useState<Condition>("CARIES");
  const [surf, setSurf] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(() => api<ChartData>(`/api/dental/chart/${patientId}`).then((r) => { if (r.ok) { setData(r.data); setLoadErr(null); } else setLoadErr(r.error); }), [patientId]);
  useEffect(() => { load(); }, [load]);

  const state = useMemo(() => new Map((data?.teeth ?? []).map((t) => [t.tooth, t])), [data]);

  function pick(n: number) {
    setSel(n); setMsg(null);
    const cur = state.get(n);
    setCond((cur?.condition as Condition) ?? "CARIES");
    setSurf(cur?.surfaces ? cur.surfaces.split("") : []);
    setNotes("");
  }

  async function save() {
    if (sel === null) return;
    setBusy(true);
    const r = await api(`/api/dental/chart/${patientId}`, "POST", { tooth: sel, condition: cond, surfaces: surf.join(""), notes });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: `Tooth ${sel} saved as ${CONDITION_STYLE[cond].label.toLowerCase()}.` });
    setNotes("");
    load();
  }

  async function undo(id: string) {
    const r = await api(`/api/dental/chart/${patientId}?recordId=${id}`, "DELETE");
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Finding undone. The previous finding is current again." });
    load();
  }

  if (loadErr) return <Notice msg={{ ok: false, text: loadErr }} />;
  if (!data) return <p className="text-sm text-ink/50">Loading chart...</p>;
  const toothHistory = sel === null ? [] : data.history.filter((h) => h.tooth === sel);

  return (
    <div className="space-y-5">
      <Card className="overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink/50">Patient&apos;s right is on the left of the chart. Click a tooth to {canWrite ? "record a finding" : "see its history"}.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPrimary} onChange={(e) => setShowPrimary(e.target.checked)} /> Show primary (milk) teeth</label>
        </div>
        <div className="min-w-[640px] space-y-1">
          <Row teeth={ADULT_UPPER} state={state} sel={sel} onPick={pick} />
          {showPrimary && <Row teeth={DECIDUOUS_UPPER} state={state} sel={sel} onPick={pick} />}
          <div className="my-1 border-t border-ink/20" />
          {showPrimary && <Row teeth={DECIDUOUS_LOWER} state={state} sel={sel} onPick={pick} />}
          <Row teeth={ADULT_LOWER} state={state} sel={sel} onPick={pick} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {CONDITIONS.map((c) => (
            <span key={c} className="flex items-center gap-1.5 text-xs text-ink/60">
              <span className="inline-block h-3 w-3 rounded-sm border" style={{ background: CONDITION_STYLE[c].fill, borderColor: CONDITION_STYLE[c].stroke }} />{CONDITION_STYLE[c].label}
            </span>
          ))}
        </div>
      </Card>

      <Notice msg={msg} />

      {sel !== null && (
        <Card>
          <h2 className="font-display text-xl">Tooth {sel} <span className="text-base text-ink/60">{toothName(sel)}</span></h2>
          <p className="mt-1 text-sm text-ink/60">Now: {state.get(sel) ? `${styleOf(state.get(sel)!.condition).label}${state.get(sel)!.surfaces ? ` (${state.get(sel)!.surfaces})` : ""}` : "No findings recorded"}</p>
          {canWrite ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Condition">
                {CONDITIONS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={cond === c} onClick={() => setCond(c)}
                    className={`rounded-full border px-3 py-1 text-sm ${cond === c ? "border-forest bg-forest text-cream" : "border-sand"}`}>{CONDITION_STYLE[c].label}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-ink/60">Surfaces</span>
                {SURFACE_ORDER.map((s) => (
                  <label key={s} className="flex items-center gap-1 text-sm" title={SURFACE_NAMES[s]}>
                    <input type="checkbox" checked={surf.includes(s)} onChange={(e) => setSurf((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))} /> {s}
                  </label>
                ))}
                <span className="text-xs text-ink/40">none ticked = whole tooth</span>
              </div>
              <input className={`w-full ${input}`} placeholder="Notes (optional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex gap-2">
                <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? "Saving..." : "Save finding"}</button>
                <button className={btnGhost} onClick={() => setSel(null)}>Close</button>
              </div>
            </div>
          ) : <p className="mt-3 text-sm text-ink/50">Only doctors and clinic admins can record findings.</p>}
          <h3 className="mt-5 text-sm font-medium">History for this tooth</h3>
          {toothHistory.length === 0 ? <p className="mt-1 text-sm text-ink/50">Nothing recorded yet.</p> : (
            <ul className="mt-1 divide-y divide-sand/60 text-sm">
              {toothHistory.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{styleOf(h.condition).label}{h.surfaces ? ` (${h.surfaces})` : ""}{h.notes ? ` - ${h.notes}` : ""}</span>
                  <span className="text-xs text-ink/50">{fmtDateTime(h.at)}{h.by ? ` · ${h.by}` : ""}{canWrite && isAdmin && <button onClick={() => undo(h.id)} className="ml-3 text-clay hover:underline">Undo</button>}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <h2 className="px-6 pt-5 font-display text-xl">All findings</h2>
        {data.history.length === 0 ? <p className="px-6 py-4 text-sm text-ink/60">No findings yet. Click a tooth to start the chart.</p> : (
          <table className="mt-2 w-full text-sm">
            <tbody>
              {data.history.map((h) => (
                <tr key={h.id} className="border-t border-sand/60">
                  <td className="px-6 py-2 font-data">{h.tooth}</td>
                  <td className="px-2 py-2 text-ink/60">{toothName(h.tooth)}</td>
                  <td className="px-2 py-2">{styleOf(h.condition).label}{h.surfaces ? ` (${h.surfaces})` : ""}</td>
                  <td className="px-2 py-2 text-ink/60">{h.notes}</td>
                  <td className="px-2 py-2 text-xs text-ink/50">{fmtDateTime(h.at)}{h.by ? ` · ${h.by}` : ""}</td>
                  <td className="px-6 py-2 text-right">{canWrite && isAdmin && <button onClick={() => undo(h.id)} className="text-clay hover:underline">Undo</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
