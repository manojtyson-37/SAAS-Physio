"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, BedSelect, btnPrimary, fromLocalInput, input, newRef, Notice, PatientPicker, type BoardWard, type Msg, type PatientOpt } from "@/components/ipd/ui";

type Doctor = { id: string; name: string; title: string | null; specialty: string | null };

function AdmitForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [patient, setPatient] = useState<PatientOpt | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [wards, setWards] = useState<BoardWard[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [bedId, setBedId] = useState(sp.get("bedId") ?? "");
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [expected, setExpected] = useState("");
  const [ref] = useState(newRef);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const pid = sp.get("patientId");
    if (pid) {
      api<{ patient?: PatientOpt } & Partial<PatientOpt>>(`/api/patients/${pid}`).then((r) => {
        const p = r.ok ? (r.data.patient ?? (r.data.id ? (r.data as PatientOpt) : null)) : null;
        if (p) setPatient({ id: p.id, name: p.name, uhid: p.uhid ?? null, phone: p.phone ?? "" });
      });
    }
    api<{ doctors: Doctor[] }>("/api/doctors").then((r) => { if (r.ok) setDoctors(r.data.doctors); });
    api<{ wards: BoardWard[] }>("/api/ipd/board").then((r) => { if (r.ok) setWards(r.data.wards); else setMsg({ ok: false, text: r.error }); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !doctorId) return setMsg({ ok: false, text: "Choose a patient and a doctor" });
    setBusy(true);
    setMsg(null);
    const r = await api<{ id: string }>("/api/ipd/admissions", "POST", {
      patientId: patient.id, doctorId, bedId: bedId || undefined, reason: reason || undefined, diagnosis: diagnosis || undefined,
      expectedDischargeAt: fromLocalInput(expected), clientRef: ref,
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    router.push(`/app/ipd/${r.data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/app/ipd" className="text-sm text-forest hover:underline">Back to admissions</Link>
        <h1 className="mt-1 font-display text-3xl">Admit patient</h1>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm"><span className="mb-1 block text-ink/60">Patient</span><PatientPicker value={patient} onChange={setPatient} /></label>
          <label className="block text-sm"><span className="mb-1 block text-ink/60">Doctor in charge</span>
            <select className={`${input} w-full`} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Choose a doctor</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.title ? `${d.title} ` : ""}{d.name}{d.specialty ? ` (${d.specialty})` : ""}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="mb-1 block text-ink/60">Bed (free beds only)</span><BedSelect wards={wards} value={bedId} onChange={setBedId} allowNone /></label>
          <label className="block text-sm"><span className="mb-1 block text-ink/60">Reason for admission</span><textarea className={`${input} w-full`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1 block text-ink/60">Provisional diagnosis</span><input className={`${input} w-full`} maxLength={500} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1 block text-ink/60">Expected discharge</span><input type="datetime-local" className={input} value={expected} onChange={(e) => setExpected(e.target.value)} /></label>
          <Notice msg={msg} />
          <button disabled={busy || !patient || !doctorId} className={btnPrimary}>{busy ? "Admitting..." : "Admit"}</button>
        </form>
      </Card>
    </div>
  );
}

export default function AdmitPage() {
  return <Suspense fallback={<p className="text-sm text-ink/50">Loading...</p>}><AdmitForm /></Suspense>;
}
