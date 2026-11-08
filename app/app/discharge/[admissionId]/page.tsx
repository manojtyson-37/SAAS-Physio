"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, day, input, Notice, useRole, type Msg } from "@/components/ipd/ui";

type Fields = { diagnosis: string; courseInHospital: string; proceduresDone: string; investigationsSummary: string; conditionAtDischarge: string; medicationsOnDischarge: string; adviceFollowUp: string; followUpDate: string };
type Data = {
  clinic: { name: string; address: string | null; phone: string | null; email: string | null } | null;
  admission: { id: string; admissionNo: string; status: string; admittedAt: string; dischargedAt: string | null; bed: string | null; dob: string | null; patient: { id: string; name: string; uhid: string | null; phone: string; gender: string | null; address: string | null; allergies: string | null; bloodGroup: string | null }; doctor: { name: string; title: string | null; specialty: string | null } };
  summary: (Partial<Record<keyof Fields, string | null>> & { status: string; finalizedAt: string | null; doctor: { name: string; title: string | null; specialty: string | null } }) | null;
  prefill: Omit<Fields, "adviceFollowUp" | "followUpDate" | "proceduresDone" | "conditionAtDischarge">;
  sources: { lab: boolean; radiology: boolean };
};
const SECTIONS: { key: keyof Fields; label: string; rows: number; prefill?: boolean }[] = [
  { key: "diagnosis", label: "Final diagnosis", rows: 2, prefill: true },
  { key: "courseInHospital", label: "Course in hospital", rows: 6, prefill: true },
  { key: "proceduresDone", label: "Procedures done", rows: 3 },
  { key: "investigationsSummary", label: "Investigations", rows: 6, prefill: true },
  { key: "conditionAtDischarge", label: "Condition at discharge", rows: 2 },
  { key: "medicationsOnDischarge", label: "Medications on discharge", rows: 5, prefill: true },
  { key: "adviceFollowUp", label: "Advice and follow-up", rows: 4 },
];
const ageOf = (dob: string | null) => (dob ? `${Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000)} yrs` : null);

export default function DischargeEditorPage({ params }: { params: Promise<{ admissionId: string }> }) {
  const { admissionId } = use(params);
  const role = useRole();
  const [data, setData] = useState<Data | null>(null);
  const [f, setF] = useState<Fields | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const apply = (d: Data) => {
    setData(d);
    const s = d.summary;
    setF({
      diagnosis: s?.diagnosis ?? d.prefill.diagnosis, courseInHospital: s?.courseInHospital ?? "", proceduresDone: s?.proceduresDone ?? "",
      investigationsSummary: s?.investigationsSummary ?? "", conditionAtDischarge: s?.conditionAtDischarge ?? "", medicationsOnDischarge: s?.medicationsOnDischarge ?? "",
      adviceFollowUp: s?.adviceFollowUp ?? "", followUpDate: s?.followUpDate ?? "",
    });
  };
  useEffect(() => {
    api<Data>(`/api/discharge/${admissionId}`).then((r) => (r.ok ? apply(r.data) : setLoadError(r.error)));
  }, [admissionId]);

  if (loadError) return <p className="text-sm text-ink/60">{loadError}. <Link href="/app/discharge" className="text-forest underline">Back to summaries</Link></p>;
  if (!data || !f) return <p className="text-sm text-ink/50">Loading...</p>;

  const a = data.admission;
  const final = data.summary?.status === "FINAL";
  const canWrite = (role === "DOCTOR" || role === "CLINIC_ADMIN") && !final && a.status === "DISCHARGED";
  const doc = data.summary?.doctor ?? a.doctor;

  const body = () => ({ ...f, followUpDate: f.followUpDate || null });
  async function save() {
    setBusy(true);
    const r = await api<{ summary: NonNullable<Data["summary"]> }>(`/api/discharge/${admissionId}`, "PUT", body());
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return false; }
    setData((d) => (d ? { ...d, summary: r.data.summary } : d));
    setMsg({ ok: true, text: "Draft saved" });
    return true;
  }
  async function finalize() {
    if (!(await save())) return;
    setBusy(true);
    const r = await api(`/api/discharge/${admissionId}/finalize`, "POST");
    setBusy(false);
    setConfirm(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Summary finalised" });
    const fresh = await api<Data>(`/api/discharge/${admissionId}`);
    if (fresh.ok) apply(fresh.data);
  }

  const printed = (label: string, text: string) => text.trim() ? (
    <section className="mt-4"><h3 className="text-sm font-bold uppercase tracking-wide">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{text}</p></section>
  ) : null;

  return (
    <div className="space-y-6">
      <style>{`@media print { @page { size: A4; margin: 14mm } body * { visibility: hidden } #dc-print, #dc-print * { visibility: visible } #dc-print { position: absolute; left: 0; top: 0; width: 100%; display: block !important } }`}</style>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/app/discharge" className="text-sm text-forest hover:underline">Back to summaries</Link>
          <h1 className="mt-1 font-display text-3xl">{a.patient.name} <span className="font-data text-base text-ink/50">{a.admissionNo}</span></h1>
          <p className="mt-1 text-sm text-ink/60">Admitted {day(a.admittedAt)}{a.dischargedAt ? `, discharged ${day(a.dischargedAt)}` : ""} · <span className={`rounded-full px-2.5 py-0.5 text-xs ${final ? "bg-forest/10 text-forest" : "bg-clay-light text-clay"}`}>{final ? "Final" : data.summary ? "Draft" : "Not started"}</span></p>
        </div>
        <div className="flex gap-2">
          <Link href={`/app/ipd/${a.id}`} className={btnGhost}>Admission</Link>
          <button onClick={() => window.print()} className={btnGhost}>Print</button>
        </div>
      </div>
      <div className="print:hidden"><Notice msg={msg} /></div>
      {a.status !== "DISCHARGED" && <Card><p className="text-sm text-ink/70">This patient is still admitted. The summary can be written once they are discharged.</p></Card>}

      <Card className="print:hidden">
        <div className="space-y-4 text-sm">
          {SECTIONS.map((s) => {
            const pre = s.prefill ? data.prefill[s.key as keyof Data["prefill"]] : "";
            return (
              <label key={s.key} className="block">
                <span className="mb-1 flex items-center justify-between text-ink/60">
                  <span>{s.label}{s.key === "investigationsSummary" && !data.sources.lab && !data.sources.radiology && <span className="ml-2 text-xs text-ink/40">(no lab or imaging module)</span>}</span>
                  {canWrite && s.prefill && pre && <button type="button" onClick={() => setF({ ...f, [s.key]: f[s.key] && f[s.key] !== pre ? `${f[s.key]}\n${pre}` : pre })} className="text-xs text-forest hover:underline">Fill from record</button>}
                </span>
                <textarea rows={s.rows} disabled={!canWrite} className={`${input} w-full disabled:bg-sand/30`} value={f[s.key]} onChange={(e) => setF({ ...f, [s.key]: e.target.value })} />
              </label>
            );
          })}
          <label className="block"><span className="mb-1 block text-ink/60">Follow-up date</span><input type="date" disabled={!canWrite} className={`${input} disabled:bg-sand/30`} value={f.followUpDate} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} /></label>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <button onClick={save} disabled={busy} className={btnGhost}>Save draft</button>
              {!confirm ? <button onClick={() => setConfirm(true)} disabled={busy} className={btnPrimary}>Finalise</button> : (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-clay-light px-3 py-2">
                  <span>Finalise? The summary becomes read-only.</span>
                  <button onClick={finalize} disabled={busy} className={btnPrimary}>Yes, finalise</button><button onClick={() => setConfirm(false)} className={btnGhost}>Cancel</button>
                </div>
              )}
            </div>
          )}
          {!canWrite && !final && a.status === "DISCHARGED" && <p className="text-xs text-ink/50">Only the doctor or clinic admin can edit the summary.</p>}
          {final && <p className="text-xs text-ink/50">Finalised {day(data.summary?.finalizedAt)}. It can no longer be edited.</p>}
        </div>
      </Card>

      {/* Print-only A4 document */}
      <div id="dc-print" className="hidden bg-white p-8 text-black">
        <header className="border-b-2 border-black pb-2 text-center">
          <h1 className="text-2xl font-bold">{data.clinic?.name}</h1>
          <p className="text-xs">{[data.clinic?.address, data.clinic?.phone, data.clinic?.email].filter(Boolean).join(" · ")}</p>
          <h2 className="mt-2 text-lg font-bold uppercase tracking-wide">Discharge summary{final ? "" : " (draft)"}</h2>
        </header>
        <table className="mt-3 w-full text-sm"><tbody>
          <tr><td className="py-0.5"><strong>Patient:</strong> {a.patient.name}</td><td><strong>UHID:</strong> {a.patient.uhid ?? "-"}</td></tr>
          <tr><td className="py-0.5"><strong>Age / sex:</strong> {[ageOf(a.dob), a.patient.gender].filter(Boolean).join(", ") || "-"}</td><td><strong>Admission no:</strong> {a.admissionNo}</td></tr>
          <tr><td className="py-0.5"><strong>Admitted:</strong> {day(a.admittedAt)}</td><td><strong>Discharged:</strong> {day(a.dischargedAt)}</td></tr>
          <tr><td className="py-0.5"><strong>Ward / bed:</strong> {a.bed ?? "-"}</td><td><strong>Doctor:</strong> {doc.title ? `${doc.title} ` : ""}{doc.name}</td></tr>
          {a.patient.allergies && <tr><td colSpan={2} className="py-0.5"><strong>Allergies:</strong> {a.patient.allergies}</td></tr>}
        </tbody></table>
        {printed("Diagnosis", f.diagnosis)}
        {printed("Course in hospital", f.courseInHospital)}
        {printed("Procedures", f.proceduresDone)}
        {printed("Investigations", f.investigationsSummary)}
        {printed("Condition at discharge", f.conditionAtDischarge)}
        {printed("Medications on discharge", f.medicationsOnDischarge)}
        {printed("Advice", f.adviceFollowUp)}
        {f.followUpDate && <p className="mt-3 text-sm"><strong>Follow-up on:</strong> {day(`${f.followUpDate}T12:00:00+05:30`)}</p>}
        <footer className="mt-16 flex justify-between text-sm">
          <span>Date: {day(final ? data.summary?.finalizedAt : new Date().toISOString())}</span>
          <span className="text-center"><span className="block w-56 border-t border-black pt-1">{doc.title ? `${doc.title} ` : ""}{doc.name}{doc.specialty ? `, ${doc.specialty}` : ""}<br />Signature</span></span>
        </footer>
      </div>
    </div>
  );
}
