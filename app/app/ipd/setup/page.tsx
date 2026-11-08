"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, input, Notice, WARD_LABEL, type Msg } from "@/components/ipd/ui";

type Bed = { id: string; label: string; dailyRate: number; isActive: boolean };
type Ward = { id: string; name: string; type: string; isActive: boolean; beds: Bed[] };

function BedRow({ bed, onDone }: { bed: Bed; onDone: (m: Msg) => void }) {
  const [edit, setEdit] = useState(false);
  const [label, setLabel] = useState(bed.label);
  const [rate, setRate] = useState(String(bed.dailyRate));
  async function save(patch: Record<string, unknown>) {
    const r = await api(`/api/ipd/beds/${bed.id}`, "PATCH", patch);
    onDone(r.ok ? { ok: true, text: "Bed updated" } : { ok: false, text: r.error });
    if (r.ok) setEdit(false);
  }
  return (
    <tr className={`border-t border-sand/60 ${bed.isActive ? "" : "opacity-60"}`}>
      <td className="py-1.5 pr-3">{edit ? <input className={`${input} w-28`} value={label} onChange={(e) => setLabel(e.target.value)} /> : <span className="font-data">{bed.label}</span>}</td>
      <td className="pr-3">{edit ? <input className={`${input} w-28`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /> : <span className="font-data">₹{bed.dailyRate.toLocaleString("en-IN")}</span>}</td>
      <td className="pr-3 text-xs text-ink/60">{bed.isActive ? "In use" : "Off"}</td>
      <td className="space-x-3 text-right text-sm">
        {edit ? (<><button onClick={() => save({ label, dailyRate: rate })} className="text-forest hover:underline">Save</button><button onClick={() => setEdit(false)} className="text-ink/60 hover:underline">Cancel</button></>)
          : (<><button onClick={() => setEdit(true)} className="text-forest hover:underline">Edit</button><button onClick={() => save({ isActive: !bed.isActive })} className="text-forest hover:underline">{bed.isActive ? "Switch off" : "Switch on"}</button></>)}
      </td>
    </tr>
  );
}

function WardCard({ ward, onChange }: { ward: Ward; onChange: (m: Msg) => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(ward.name);
  const [type, setType] = useState(ward.type);
  const [label, setLabel] = useState("");
  const [rate, setRate] = useState("");
  async function patchWard(p: Record<string, unknown>) {
    const r = await api(`/api/ipd/wards/${ward.id}`, "PATCH", p);
    onChange(r.ok ? { ok: true, text: "Ward updated" } : { ok: false, text: r.error });
    if (r.ok) setEdit(false);
  }
  async function addBed(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/ipd/beds", "POST", { wardId: ward.id, label, dailyRate: rate || 0 });
    onChange(r.ok ? { ok: true, text: "Bed added" } : { ok: false, text: r.error });
    if (r.ok) { setLabel(""); setRate(""); }
  }
  return (
    <Card className={ward.isActive ? "" : "opacity-70"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {edit ? (
          <div className="flex flex-wrap gap-2">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
            <select className={input} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(WARD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button onClick={() => patchWard({ name, type })} className={btnPrimary}>Save</button><button onClick={() => setEdit(false)} className={btnGhost}>Cancel</button>
          </div>
        ) : (
          <h2 className="font-display text-xl">{ward.name} <span className="ml-1 font-sans text-xs text-ink/50">{WARD_LABEL[ward.type] ?? ward.type}{ward.isActive ? "" : " · off"}</span></h2>
        )}
        {!edit && <div className="space-x-3 text-sm"><button onClick={() => setEdit(true)} className="text-forest hover:underline">Edit</button><button onClick={() => patchWard({ isActive: !ward.isActive })} className="text-forest hover:underline">{ward.isActive ? "Switch off" : "Switch on"}</button></div>}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink/50"><th className="py-1">Bed</th><th>Rate per day</th><th>Status</th><th /></tr></thead>
          <tbody>
            {ward.beds.length === 0 && <tr><td colSpan={4} className="py-2 text-ink/50">No beds yet.</td></tr>}
            {ward.beds.map((b) => <BedRow key={`${b.id}:${b.label}:${b.dailyRate}`} bed={b} onDone={onChange} />)}
          </tbody>
        </table>
      </div>
      <form onSubmit={addBed} className="mt-3 flex flex-wrap items-end gap-2 border-t border-sand pt-3 text-sm">
        <label>New bed<input className={`${input} mt-1 block w-28`} placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required /></label>
        <label>Rate per day<input className={`${input} mt-1 block w-28`} inputMode="decimal" placeholder="0" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <button className={btnGhost}>Add bed</button>
      </form>
    </Card>
  );
}

export default function IpdSetupPage() {
  const [wards, setWards] = useState<Ward[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("GENERAL");
  const load = useCallback(() => { api<{ wards: Ward[] }>("/api/ipd/wards").then((r) => (r.ok ? setWards(r.data.wards) : setMsg({ ok: false, text: r.error }))); }, []);
  useEffect(() => { load(); }, [load]);
  const done = (m: Msg) => { setMsg(m); load(); };

  async function addWard(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/ipd/wards", "POST", { name, type });
    if (r.ok) setName("");
    done(r.ok ? { ok: true, text: "Ward added" } : { ok: false, text: r.error });
  }
  async function defaults() {
    const r = await api<{ wardsAdded: number; bedsAdded: number }>("/api/ipd/setup/defaults", "POST");
    done(r.ok ? { ok: true, text: `Added ${r.data.wardsAdded} wards and ${r.data.bedsAdded} beds` } : { ok: false, text: r.error });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/app/ipd" className="text-sm text-forest hover:underline">Back to admissions</Link><h1 className="mt-1 font-display text-3xl">Wards and beds</h1>
          <p className="mt-1 text-sm text-ink/60">A bed with an admitted patient cannot be switched off. Rate changes apply to new stays only.</p></div>
        <button onClick={defaults} className={btnGhost}>Add starter layout</button>
      </div>
      <Notice msg={msg} />
      <Card>
        <form onSubmit={addWard} className="flex flex-wrap items-end gap-2 text-sm">
          <label>New ward<input className={`${input} mt-1 block`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maternity" required minLength={2} /></label>
          <label>Type<select className={`${input} mt-1 block`} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(WARD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <button className={btnPrimary}>Add ward</button>
        </form>
      </Card>
      {wards && wards.length === 0 && <Card><p className="text-sm text-ink/60">No wards yet. Add one above, or use the starter layout (General 6 beds, Private 4, ICU 4) and adjust rates.</p></Card>}
      {wards?.map((w) => <WardCard key={`${w.id}:${w.name}:${w.type}:${w.isActive}:${w.beds.length}`} ward={w} onChange={done} />)}
    </div>
  );
}
