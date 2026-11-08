"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { useHasModule } from "@/components/ClinicContext";
import { api, BedSelect, btnGhost, btnPrimary, day, fromLocalInput, input, inr, Notice, toLocalInput, when, type AdmissionRow, type BoardWard, type Msg } from "@/components/ipd/ui";

type Entry = { id: string; kind: string; recordedAt: string; systolic: number | null; diastolic: number | null; pulse: number | null; respRate: number | null; spo2: number | null; tempC: number | null; gcs: number | null; intakeMl: number | null; outputMl: number | null; notes: string | null };
type Charge = { label: string; days: number; rate: number; amount: number };
type Detail = {
  admission: AdmissionRow; stays: { id: string; startedAt: string; endedAt: string | null; rate: number; bed: string }[];
  charges: { lines: Charge[]; total: number }; billingOn: boolean; invoice: { id: string; number: string; status: string; total: number } | null; summary: { id: string; status: string } | null;
};
type Doctor = { id: string; name: string; title: string | null };
const NUM = ["systolic", "diastolic", "pulse", "respRate", "spo2", "tempC", "gcs", "intakeMl", "outputMl"] as const;
const LABEL: Record<(typeof NUM)[number], string> = { systolic: "Systolic", diastolic: "Diastolic", pulse: "Pulse", respRate: "Resp rate", spo2: "SpO2 %", tempC: "Temp C", gcs: "GCS", intakeMl: "Intake ml", outputMl: "Output ml" };
type Form = Record<(typeof NUM)[number], string> & { kind: string; recordedAt: string; notes: string };
const blankForm = (): Form => ({ kind: "NURSING", recordedAt: "", notes: "", systolic: "", diastolic: "", pulse: "", respRate: "", spo2: "", tempC: "", gcs: "", intakeMl: "", outputMl: "" });

export default function AdmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dischargeOn = useHasModule("discharge");
  const [d, setD] = useState<Detail | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [wards, setWards] = useState<BoardWard[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState({ diagnosis: "", notes: "", reason: "", expected: "", doctorId: "" });
  const [toBed, setToBed] = useState("");
  const [form, setForm] = useState<Form>(blankForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDischarge, setConfirmDischarge] = useState(false);

  const load = useCallback(() => {
    api<Detail>(`/api/ipd/admissions/${id}`).then((r) => (r.ok ? setD(r.data) : setLoadError(r.error)));
    api<{ entries: Entry[] }>(`/api/ipd/admissions/${id}/chart`).then((r) => { if (r.ok) setEntries(r.data.entries); });
    api<{ wards: BoardWard[] }>("/api/ipd/board").then((r) => { if (r.ok) setWards(r.data.wards); });
  }, [id]);
  useEffect(() => { load(); api<{ doctors: Doctor[] }>("/api/doctors").then((r) => { if (r.ok) setDoctors(r.data.doctors); }); }, [load]);

  if (loadError) return <p className="text-sm text-ink/60">{loadError}. <Link href="/app/ipd" className="text-forest underline">Back to admissions</Link></p>;
  if (!d) return <p className="text-sm text-ink/50">Loading...</p>;
  const a = d.admission;
  const open = a.status === "ADMITTED";

  async function run<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, okText: string, after?: (x: T) => void) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return false; }
    setMsg({ ok: true, text: okText });
    after?.(r.data);
    load();
    return true;
  }

  const startEdit = () => {
    setEf({ diagnosis: a.diagnosis ?? "", notes: a.notes ?? "", reason: a.reason ?? "", expected: toLocalInput(a.expectedDischargeAt), doctorId: a.doctor.id });
    setEditing(true);
  };
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(api(`/api/ipd/admissions/${id}`, "PATCH", { diagnosis: ef.diagnosis, notes: ef.notes, reason: ef.reason, expectedDischargeAt: fromLocalInput(ef.expected) ?? null, doctorId: ef.doctorId }), "Admission updated")) setEditing(false);
  };

  const body = () => ({
    kind: form.kind, recordedAt: fromLocalInput(form.recordedAt), notes: form.notes,
    ...Object.fromEntries(NUM.map((k) => [k, form[k]])),
  });
  const saveChart = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = editId ? { ...body(), ...Object.fromEntries(NUM.map((k) => [k, form[k] === "" ? null : form[k]])) } : body();
    const ok = await run(api(editId ? `/api/ipd/admissions/${id}/chart/${editId}` : `/api/ipd/admissions/${id}/chart`, editId ? "PATCH" : "POST", payload), editId ? "Entry updated" : "Entry added");
    if (ok) { setForm(blankForm()); setEditId(null); }
  };
  const editEntry = (en: Entry) => {
    setEditId(en.id);
    setForm({ ...blankForm(), kind: en.kind, recordedAt: toLocalInput(en.recordedAt), notes: en.notes ?? "", ...Object.fromEntries(NUM.map((k) => [k, en[k] === null ? "" : String(en[k])])) });
    window.scrollTo({ top: document.getElementById("chart-form")?.offsetTop ?? 0, behavior: "smooth" });
  };

  const admitted = a.status === "ADMITTED";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/ipd" className="text-sm text-forest hover:underline">Back to admissions</Link>
          <h1 className="mt-1 font-display text-3xl">{a.patient.name} <span className="font-data text-base text-ink/50">{a.admissionNo}</span></h1>
          <p className="mt-1 text-sm text-ink/60">
            <Link href={`/app/patients/${a.patient.id}`} className="text-forest hover:underline">{a.patient.uhid ?? "Patient"}</Link> · {a.patient.phone} ·
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs ${open ? "bg-clay-light text-clay" : "bg-forest/10 text-forest"}`}>{open ? "Admitted" : "Discharged"}</span>
          </p>
        </div>
        {!open && dischargeOn && <Link href={`/app/discharge/${a.id}`} className={btnPrimary}>Discharge summary</Link>}
      </div>
      <Notice msg={msg} />

      <Card>
        <div className="flex items-center justify-between"><h2 className="font-display text-xl">Admission</h2>{open && !editing && <button onClick={startEdit} className="text-sm text-forest hover:underline">Edit</button>}</div>
        {!editing ? (
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-ink/50">Doctor</dt><dd>{a.doctor.title ? `${a.doctor.title} ` : ""}{a.doctor.name}</dd></div>
            <div><dt className="text-xs text-ink/50">Bed</dt><dd>{a.bed ? `${a.bed.wardName} / ${a.bed.label}` : "No bed assigned"}</dd></div>
            <div><dt className="text-xs text-ink/50">Admitted</dt><dd>{when(a.admittedAt)} (day {a.days})</dd></div>
            <div><dt className="text-xs text-ink/50">{open ? "Expected discharge" : "Discharged"}</dt><dd>{open ? (a.expectedDischargeAt ? when(a.expectedDischargeAt) : "-") : when(a.dischargedAt)}</dd></div>
            <div><dt className="text-xs text-ink/50">Reason</dt><dd>{a.reason ?? "-"}</dd></div>
            <div><dt className="text-xs text-ink/50">Diagnosis</dt><dd>{a.diagnosis ?? "-"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-ink/50">Notes</dt><dd className="whitespace-pre-wrap">{a.notes ?? "-"}</dd></div>
          </dl>
        ) : (
          <form onSubmit={saveEdit} className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <label>Doctor<select className={`${input} mt-1 w-full`} value={ef.doctorId} onChange={(e) => setEf({ ...ef, doctorId: e.target.value })}>{doctors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label>Expected discharge<input type="datetime-local" className={`${input} mt-1 w-full`} value={ef.expected} onChange={(e) => setEf({ ...ef, expected: e.target.value })} /></label>
            <label>Reason<input className={`${input} mt-1 w-full`} maxLength={500} value={ef.reason} onChange={(e) => setEf({ ...ef, reason: e.target.value })} /></label>
            <label>Diagnosis<input className={`${input} mt-1 w-full`} maxLength={500} value={ef.diagnosis} onChange={(e) => setEf({ ...ef, diagnosis: e.target.value })} /></label>
            <label className="sm:col-span-2">Notes<textarea rows={3} className={`${input} mt-1 w-full`} maxLength={2000} value={ef.notes} onChange={(e) => setEf({ ...ef, notes: e.target.value })} /></label>
            <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className={btnPrimary}>Save</button><button type="button" onClick={() => setEditing(false)} className={btnGhost}>Cancel</button></div>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-xl">Bed stays</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink/50"><th className="py-1 pr-4">Bed</th><th className="pr-4">From</th><th className="pr-4">To</th><th className="pr-4">Rate/day</th></tr></thead>
            <tbody>
              {d.stays.length === 0 && <tr><td colSpan={4} className="py-2 text-ink/50">No bed assigned yet.</td></tr>}
              {d.stays.map((s) => <tr key={s.id} className="border-t border-sand/60"><td className="py-1.5 pr-4">{s.bed}</td><td className="pr-4 text-ink/60">{when(s.startedAt)}</td><td className="pr-4 text-ink/60">{s.endedAt ? when(s.endedAt) : "now"}</td><td className="pr-4 font-data">{inr(s.rate)}</td></tr>)}
            </tbody>
          </table>
        </div>
        {admitted && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-sand pt-4 text-sm">
            <label className="min-w-56 flex-1">{a.bed ? "Move to another bed" : "Assign a bed"}<div className="mt-1"><BedSelect wards={wards} value={toBed} onChange={setToBed} exceptBedId={a.bed?.id} /></div></label>
            <button disabled={!toBed || busy} className={btnGhost} onClick={() => run(api(`/api/ipd/admissions/${id}/transfer`, "POST", { toBedId: toBed }), "Patient moved", () => setToBed(""))}>{a.bed ? "Transfer" : "Assign"}</button>
          </div>
        )}
      </Card>

      <div id="chart-form"><Card>
        <h2 className="font-display text-xl">Nursing and ICU chart</h2>
        {open && (
          <form onSubmit={saveChart} className="mt-3 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <label>Type<select className={`${input} mt-1 w-full`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="NURSING">Nursing</option><option value="ICU">ICU</option></select></label>
              <label>Time (blank = now)<input type="datetime-local" className={`${input} mt-1 w-full`} value={form.recordedAt} onChange={(e) => setForm({ ...form, recordedAt: e.target.value })} /></label>
              {NUM.map((k) => <label key={k}>{LABEL[k]}<input inputMode="decimal" className={`${input} mt-1 w-full`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}
            </div>
            <label className="block">Notes<textarea rows={2} maxLength={2000} className={`${input} mt-1 w-full`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="flex gap-2"><button disabled={busy} className={btnPrimary}>{editId ? "Save entry" : "Add entry"}</button>{editId && <button type="button" className={btnGhost} onClick={() => { setEditId(null); setForm(blankForm()); }}>Cancel edit</button>}</div>
          </form>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-left text-xs text-ink/50"><th className="py-1 pr-3">Time</th><th className="pr-3">Type</th><th className="pr-3">BP</th><th className="pr-3">Pulse</th><th className="pr-3">RR</th><th className="pr-3">SpO2</th><th className="pr-3">Temp</th><th className="pr-3">GCS</th><th className="pr-3">In/Out ml</th><th className="pr-3">Notes</th><th /></tr></thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={11} className="py-3 text-ink/50">No chart entries yet.</td></tr>}
              {entries.map((en) => (
                <tr key={en.id} className="border-t border-sand/60 align-top">
                  <td className="py-1.5 pr-3 text-xs text-ink/60">{when(en.recordedAt)}</td>
                  <td className="pr-3"><span className={`rounded-full px-2 py-0.5 text-xs ${en.kind === "ICU" ? "bg-clay-light text-clay" : "bg-sand text-ink/60"}`}>{en.kind === "ICU" ? "ICU" : "Nursing"}</span></td>
                  <td className="pr-3 font-data">{en.systolic !== null || en.diastolic !== null ? `${en.systolic ?? "-"}/${en.diastolic ?? "-"}` : "-"}</td>
                  <td className="pr-3 font-data">{en.pulse ?? "-"}</td><td className="pr-3 font-data">{en.respRate ?? "-"}</td><td className="pr-3 font-data">{en.spo2 ?? "-"}</td>
                  <td className="pr-3 font-data">{en.tempC ?? "-"}</td><td className="pr-3 font-data">{en.gcs ?? "-"}</td>
                  <td className="pr-3 font-data">{en.intakeMl ?? "-"}/{en.outputMl ?? "-"}</td>
                  <td className="max-w-64 pr-3 text-ink/70">{en.notes}</td>
                  <td className="text-right">{open && <button onClick={() => editEntry(en)} className="text-forest hover:underline">Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card></div>

      <Card>
        <h2 className="font-display text-xl">{open ? "Bed charges so far" : "Bed charges"}</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {d.charges.lines.map((l, i) => <tr key={i} className="border-t border-sand/60"><td className="py-1.5">{l.label}</td><td className="text-ink/60">{l.days} day{l.days === 1 ? "" : "s"} × {inr(l.rate)}</td><td className="text-right font-data">{inr(l.amount)}</td></tr>)}
            {d.charges.lines.length === 0 && <tr><td className="py-2 text-ink/50">No bed charges.</td></tr>}
            <tr className="border-t border-sand"><td className="py-2 font-medium" colSpan={2}>Total</td><td className="text-right font-data font-medium">{inr(d.charges.total)}</td></tr>
          </tbody>
        </table>
        {d.invoice && <p className="mt-2 text-sm">Invoice <Link href={`/app/invoices/${d.invoice.id}`} className="font-data text-forest hover:underline">{d.invoice.number}</Link> · {d.invoice.status}</p>}
        {open && (
          <div className="mt-4 border-t border-sand pt-4">
            {!confirmDischarge ? (
              <button className={btnPrimary} onClick={() => setConfirmDischarge(true)}>Discharge patient</button>
            ) : (
              <div className="space-y-2 rounded-lg bg-clay-light p-3 text-sm">
                <p>Discharge <strong>{a.patient.name}</strong>? The bed is freed and bed charges of <strong>{inr(d.charges.total)}</strong> are final{d.billingOn && d.charges.total > 0 ? " and an invoice is created" : ""}. This cannot be undone.</p>
                <div className="flex gap-2">
                  <button disabled={busy} className={btnPrimary} onClick={() => run(api(`/api/ipd/admissions/${id}/discharge`, "POST"), "Patient discharged", () => setConfirmDischarge(false))}>{busy ? "Discharging..." : "Yes, discharge"}</button>
                  <button className={btnGhost} onClick={() => setConfirmDischarge(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {!open && <p className="mt-3 text-xs text-ink/50">Discharged on {day(a.dischargedAt)}.</p>}
      </Card>
    </div>
  );
}
