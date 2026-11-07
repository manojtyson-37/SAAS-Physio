"use client";

import VisitBilling from "@/components/billing/VisitBilling";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { COMMON_GENERICS, FORMS, FREQUENCIES } from "@/lib/hospital/commonGenerics";

type RxItem = {
  genericName: string;
  brandName: string;
  form: string;
  strength: string;
  frequency: string;
  durationDays: string;
  instructions: string;
};
type Visit = {
  id: string;
  tokenNumber: number;
  tokenDate: string;
  status: "WAITING" | "IN_CONSULT" | "COMPLETED" | "CANCELLED";
  type: string;
  chiefComplaint: string | null;
  diagnosis: string | null;
  advice: string | null;
  followUpDate: string | null;
  patient: {
    id: string;
    name: string;
    phone: string;
    uhid: string | null;
    gender: string | null;
    dob: string | null;
    bloodGroup: string | null;
    allergies: string | null;
    abhaId: string | null;
  };
  doctor: { id: string; name: string; specialty: string | null; title: string | null };
  vitals: {
    id: string;
    systolic: number | null;
    diastolic: number | null;
    pulse: number | null;
    respRate: number | null;
    spo2: number | null;
    tempC: number | null;
    weightKg: number | null;
    heightCm: number | null;
    bmi: number | null;
    recordedAt: string;
    recordedBy: { name: string };
  }[];
  prescription: {
    notes: string | null;
    items: {
      genericName: string;
      brandName: string | null;
      form: string | null;
      strength: string | null;
      frequency: string;
      durationDays: number | null;
      instructions: string | null;
    }[];
  } | null;
};

const blankItem = (): RxItem => ({ genericName: "", brandName: "", form: "Tablet", strength: "", frequency: "1-0-1", durationDays: "5", instructions: "" });
const blankVitals = { systolic: "", diastolic: "", pulse: "", spo2: "", tempC: "", respRate: "", weightKg: "", heightCm: "" };

const ageOf = (dob: string | null) => {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const input = "w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm outline-none focus:border-forest disabled:bg-sand/30";

export default function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [role, setRole] = useState<string>("");
  const [notFound, setNotFound] = useState(false);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [vitals, setVitals] = useState(blankVitals);
  const [consult, setConsult] = useState({ chiefComplaint: "", diagnosis: "", advice: "", followUpDate: "" });
  const [items, setItems] = useState<RxItem[]>([blankItem()]);
  const [rxNotes, setRxNotes] = useState("");

  useEffect(() => {
    let cancel = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!cancel) setRole(d.user?.role ?? d.session?.role ?? d.role ?? "");
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/visits/${id}`).then(async (r) => {
      if (cancel) return;
      if (!r.ok) {
        setNotFound(true);
        return;
      }
      const { visit: v } = (await r.json()) as { visit: Visit };
      setVisit(v);
      setConsult({
        chiefComplaint: v.chiefComplaint ?? "",
        diagnosis: v.diagnosis ?? "",
        advice: v.advice ?? "",
        followUpDate: v.followUpDate ? v.followUpDate.slice(0, 10) : "",
      });
      setItems(
        v.prescription?.items.length
          ? v.prescription.items.map((i) => ({
              genericName: i.genericName,
              brandName: i.brandName ?? "",
              form: i.form ?? "Tablet",
              strength: i.strength ?? "",
              frequency: i.frequency,
              durationDays: i.durationDays ? String(i.durationDays) : "",
              instructions: i.instructions ?? "",
            }))
          : [blankItem()],
      );
      setRxNotes(v.prescription?.notes ?? "");
    });
    return () => {
      cancel = true;
    };
  }, [id, tick]);

  const isClinician = role === "DOCTOR" || role === "CLINIC_ADMIN";
  const open = visit?.status === "WAITING" || visit?.status === "IN_CONSULT";

  async function call(method: string, path: string, body: unknown, okText: string) {
    setMsg(null);
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? "Something went wrong" });
      return false;
    }
    setMsg({ ok: true, text: okText });
    setTick((n) => n + 1);
    return true;
  }

  async function saveVitals(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, number> = {};
    for (const [k, v] of Object.entries(vitals)) if (v !== "") body[k] = Number(v);
    if (await call("POST", `/api/visits/${id}/vitals`, body, "Vitals recorded")) setVitals(blankVitals);
  }

  const saveConsult = () =>
    call(
      "PATCH",
      `/api/visits/${id}`,
      {
        chiefComplaint: consult.chiefComplaint,
        diagnosis: consult.diagnosis,
        advice: consult.advice,
        ...(consult.followUpDate ? { followUpDate: consult.followUpDate } : {}),
      },
      "Consultation notes saved",
    );

  const saveRx = () => {
    const clean = items
      .filter((i) => i.genericName.trim())
      .map((i) => ({
        genericName: i.genericName,
        brandName: i.brandName || undefined,
        form: i.form || undefined,
        strength: i.strength || undefined,
        frequency: i.frequency,
        durationDays: i.durationDays ? Number(i.durationDays) : undefined,
        instructions: i.instructions || undefined,
      }));
    return call("PUT", `/api/visits/${id}/prescription`, { items: clean, notes: rxNotes || undefined }, "Prescription saved");
  };

  const setStatus = (status: string) => call("PATCH", `/api/visits/${id}`, { status }, `Visit marked ${status.toLowerCase().replace("_", " ")}`);

  const patchItem = (i: number, p: Partial<RxItem>) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, ...p } : x)));

  if (notFound) return <p className="text-sm text-ink/60">Visit not found. <Link href="/app/opd" className="text-forest underline">Back to queue</Link></p>;
  if (!visit) return <p className="text-sm text-ink/50">Loading…</p>;

  const p = visit.patient;
  const age = ageOf(p.dob);
  const latest = visit.vitals[0];
  const savedRx = visit.prescription?.items ?? [];

  return (
    <div className="space-y-6">
      <datalist id="generics">
        {COMMON_GENERICS.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/opd" className="text-xs text-ink/50 hover:text-forest">← OPD queue</Link>
          <h1 className="mt-1 font-display text-3xl">
            Token #{visit.tokenNumber} · {p.name}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {p.uhid ?? "no UHID"} · {[p.gender, age !== null ? `${age} yrs` : null, p.bloodGroup].filter(Boolean).join(" · ") || "—"} · {p.phone}
            {p.abhaId ? ` · ABHA ${p.abhaId}` : ""}
          </p>
          <p className="text-sm text-ink/60">
            {visit.doctor.name} · {visit.type} · {visit.status.replace("_", " ").toLowerCase()}
          </p>
        </div>
        {isClinician && open && (
          <div className="flex gap-2">
            {visit.status === "WAITING" && (
              <button onClick={() => setStatus("IN_CONSULT")} className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
                Start consult
              </button>
            )}
            {visit.status === "IN_CONSULT" && (
              <button onClick={() => setStatus("COMPLETED")} className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
                Complete visit
              </button>
            )}
            <button onClick={() => setStatus("CANCELLED")} className="rounded-full border border-sand px-4 py-2 text-sm text-ink/60 hover:bg-sand/50">
              Cancel
            </button>
          </div>
        )}
      </div>

      {p.allergies && (
        <div className="rounded-xl border border-clay/40 bg-clay-light/30 px-4 py-3 text-sm text-clay">⚠ Allergies: {p.allergies}</div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-forest" : "text-clay"}`}>{msg.text}</p>}
      {!open && <p className="rounded-xl bg-sand/50 px-4 py-3 text-sm text-ink/60">This visit is {visit.status.toLowerCase()}. Records are read-only.</p>}

      <VisitBilling visitId={visit.id} patientId={p.id} role={role} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl">Vitals</h2>
          {latest && (
            <p className="mt-2 text-sm text-ink/70">
              Last: BP {latest.systolic ?? "–"}/{latest.diastolic ?? "–"} · Pulse {latest.pulse ?? "–"} · SpO₂ {latest.spo2 ?? "–"}% · Temp {latest.tempC ?? "–"}°C
              {latest.bmi ? ` · BMI ${latest.bmi}` : ""} <span className="text-ink/40">({latest.recordedBy.name})</span>
            </p>
          )}
          {open && (
            <form onSubmit={saveVitals} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["systolic", "BP sys", "mmHg"],
                  ["diastolic", "BP dia", "mmHg"],
                  ["pulse", "Pulse", "/min"],
                  ["spo2", "SpO₂", "%"],
                  ["tempC", "Temp", "°C"],
                  ["respRate", "Resp", "/min"],
                  ["weightKg", "Weight", "kg"],
                  ["heightCm", "Height", "cm"],
                ] as const
              ).map(([k, label, unit]) => (
                <label key={k} className="text-[10px] uppercase tracking-widest text-ink/40">
                  {label} <span className="normal-case">({unit})</span>
                  <input
                    type="number"
                    step="any"
                    value={vitals[k]}
                    onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })}
                    className={`mt-1 ${input}`}
                  />
                </label>
              ))}
              <div className="col-span-full">
                <button type="submit" className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
                  Record vitals
                </button>
              </div>
            </form>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-xl">Consultation</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-[10px] uppercase tracking-widest text-ink/40">
              Chief complaint
              <input disabled={!open} value={consult.chiefComplaint} onChange={(e) => setConsult({ ...consult, chiefComplaint: e.target.value })} className={`mt-1 ${input}`} />
            </label>
            <label className="block text-[10px] uppercase tracking-widest text-ink/40">
              Diagnosis
              <textarea disabled={!open || !isClinician} rows={2} value={consult.diagnosis} onChange={(e) => setConsult({ ...consult, diagnosis: e.target.value })} className={`mt-1 ${input}`} />
            </label>
            <label className="block text-[10px] uppercase tracking-widest text-ink/40">
              Advice
              <textarea disabled={!open || !isClinician} rows={2} value={consult.advice} onChange={(e) => setConsult({ ...consult, advice: e.target.value })} className={`mt-1 ${input}`} />
            </label>
            <label className="block text-[10px] uppercase tracking-widest text-ink/40">
              Follow-up date
              <input type="date" disabled={!open || !isClinician} value={consult.followUpDate} onChange={(e) => setConsult({ ...consult, followUpDate: e.target.value })} className={`mt-1 ${input}`} />
            </label>
            {open && isClinician && (
              <button onClick={saveConsult} className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
                Save notes
              </button>
            )}
            {open && !isClinician && <p className="text-xs text-ink/50">Diagnosis and advice are recorded by the doctor.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Prescription</h2>
          {savedRx.length > 0 && (
            <button onClick={() => window.print()} className="rounded-lg border border-sand px-4 py-1.5 text-sm hover:bg-sand/50">
              Print Rx
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink/50">Write generic (non-proprietary) names, as required by NMC. Brand is optional.</p>

        <div className="mt-4 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-sand/70 p-3 sm:grid-cols-12">
              <input disabled={!open || !isClinician} list="generics" placeholder="Generic name *" value={it.genericName} onChange={(e) => patchItem(i, { genericName: e.target.value })} className={`col-span-2 sm:col-span-4 ${input}`} />
              <input disabled={!open || !isClinician} placeholder="Brand (optional)" value={it.brandName} onChange={(e) => patchItem(i, { brandName: e.target.value })} className={`col-span-2 sm:col-span-2 ${input}`} />
              <select disabled={!open || !isClinician} value={it.form} onChange={(e) => patchItem(i, { form: e.target.value })} className={`sm:col-span-2 ${input}`}>
                {FORMS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <input disabled={!open || !isClinician} placeholder="Strength" value={it.strength} onChange={(e) => patchItem(i, { strength: e.target.value })} className={`sm:col-span-2 ${input}`} />
              <select disabled={!open || !isClinician} value={it.frequency} onChange={(e) => patchItem(i, { frequency: e.target.value })} className={`sm:col-span-2 ${input}`}>
                {FREQUENCIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <input disabled={!open || !isClinician} type="number" min={1} placeholder="Days" value={it.durationDays} onChange={(e) => patchItem(i, { durationDays: e.target.value })} className={`sm:col-span-2 ${input}`} />
              <input disabled={!open || !isClinician} placeholder="Instructions (e.g. after food)" value={it.instructions} onChange={(e) => patchItem(i, { instructions: e.target.value })} className={`col-span-2 sm:col-span-8 ${input}`} />
              {open && isClinician && (
                <button type="button" onClick={() => setItems((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : [blankItem()]))} className="col-span-2 rounded-lg px-3 py-2 text-sm text-clay hover:bg-clay-light/30">
                  Remove
                </button>
              )}
            </div>
          ))}
          {open && isClinician && (
            <>
              <button type="button" onClick={() => setItems((arr) => [...arr, blankItem()])} className="rounded-lg border border-dashed border-sand px-4 py-2 text-sm text-ink/60 hover:bg-sand/40">
                + Add medicine
              </button>
              <label className="block text-[10px] uppercase tracking-widest text-ink/40">
                Notes to patient
                <textarea rows={2} value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} className={`mt-1 ${input}`} />
              </label>
              <button onClick={saveRx} className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
                Save prescription
              </button>
            </>
          )}
          {!isClinician && <p className="text-xs text-ink/50">Only the doctor can write or edit the prescription.</p>}
        </div>
      </Card>

      {/* Print-only prescription sheet */}
      <style>{`@media print { body * { visibility: hidden } #rx-print, #rx-print * { visibility: visible } #rx-print { position: absolute; left: 0; top: 0; width: 100%; display: block !important } }`}</style>
      <div id="rx-print" className="hidden bg-white p-10 text-black">
        <h1 className="text-2xl font-bold">{visit.doctor.title ? `${visit.doctor.title} ` : ""}{visit.doctor.name}</h1>
        {visit.doctor.specialty && <p className="text-sm">{visit.doctor.specialty}</p>}
        <hr className="my-3 border-black" />
        <p className="text-sm">
          <strong>{p.name}</strong> · {p.uhid ?? ""} · {[p.gender, age !== null ? `${age} yrs` : null].filter(Boolean).join(", ")} · Date: {fmt(visit.tokenDate)} · Token #{visit.tokenNumber}
        </p>
        {p.allergies && <p className="text-sm">Allergies: {p.allergies}</p>}
        {visit.diagnosis && <p className="mt-2 text-sm"><strong>Diagnosis:</strong> {visit.diagnosis}</p>}
        <h2 className="mt-4 text-lg font-bold">℞</h2>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {savedRx.map((i, n) => (
              <tr key={n} className="align-top">
                <td className="py-1 pr-3">{n + 1}.</td>
                <td className="py-1 pr-3">
                  <strong>{i.genericName}</strong> {i.strength} {i.form}
                  {i.brandName ? ` (${i.brandName})` : ""}
                  {i.instructions ? <div className="text-xs">{i.instructions}</div> : null}
                </td>
                <td className="py-1 pr-3">{i.frequency}</td>
                <td className="py-1">{i.durationDays ? `${i.durationDays} days` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visit.prescription?.notes && <p className="mt-3 text-sm">{visit.prescription.notes}</p>}
        {visit.advice && <p className="mt-3 text-sm"><strong>Advice:</strong> {visit.advice}</p>}
        {visit.followUpDate && <p className="mt-1 text-sm"><strong>Follow-up:</strong> {fmt(visit.followUpDate)}</p>}
      </div>
    </div>
  );
}
