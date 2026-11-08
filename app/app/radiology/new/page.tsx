"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { useHasModule } from "@/components/ClinicContext";
import { newRef, PatientPicker, type PickPatient } from "@/components/lab/shared";
import { api, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";
import { MODALITY_LABEL, type Modality } from "@/lib/radiology/logic";

type Type = { id: string; modality: Modality; name: string; bodyPart: string | null; price: number; gstPercent: number };

function NewImagingOrder() {
  const router = useRouter();
  const sp = useSearchParams();
  const billingOn = useHasModule("billing");
  const [patient, setPatient] = useState<PickPatient | null>(null);
  const [types, setTypes] = useState<Type[] | null>(null);
  const [typeId, setTypeId] = useState("");
  const [info, setInfo] = useState("");
  const [bill, setBill] = useState(true);
  const [ref] = useState(newRef);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const preId = sp.get("patientId");
  const visitId = sp.get("visitId") || undefined;

  useEffect(() => {
    api<{ types: Type[] }>("/api/radiology/types").then((r) => (r.ok ? setTypes(r.data.types) : (setTypes([]), setMsg({ ok: false, text: r.error }))));
  }, []);
  useEffect(() => {
    if (!preId) return;
    api<{ patient: PickPatient }>(`/api/patients/${preId}`).then((r) => { if (r.ok) setPatient(r.data.patient); });
  }, [preId]);

  const chosen = types?.find((t) => t.id === typeId);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !chosen) return;
    setBusy(true);
    setMsg(null);
    const r = await api<{ id: string }>("/api/radiology/orders", "POST", { patientId: patient.id, studyTypeId: chosen.id, clinicalInfo: info || undefined, bill: billingOn && bill, visitId, clientRef: ref });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    router.push(`/app/radiology/${r.data.id}`);
  }
  const groups = [...new Set((types ?? []).map((t) => t.modality))];

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Link href="/app/radiology" className="text-sm text-forest hover:underline">Back to radiology</Link>
        <h1 className="mt-2 font-display text-3xl">New imaging order</h1>
      </div>
      <Notice msg={msg} />
      <Card className="space-y-3"><h2 className="font-display text-xl">Patient</h2><PatientPicker value={patient} onChange={setPatient} /></Card>
      <Card className="space-y-3">
        <h2 className="font-display text-xl">Study</h2>
        {types === null ? <p className="text-sm text-ink/60">Loading...</p> : types.length === 0 ? (
          <p className="text-sm text-ink/60">No study types yet. <Link href="/app/radiology/types" className="text-forest underline">Add study types or load the starter set</Link>.</p>
        ) : (
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Study" required className={`${input} w-full sm:w-96`}>
            <option value="">Choose a study</option>
            {groups.map((m) => (
              <optgroup key={m} label={MODALITY_LABEL[m]}>
                {types.filter((t) => t.modality === m).map((t) => <option key={t.id} value={t.id}>{t.name} ({inr(t.price)})</option>)}
              </optgroup>
            ))}
          </select>
        )}
        <textarea value={info} onChange={(e) => setInfo(e.target.value)} maxLength={500} rows={2} placeholder="Clinical information for the radiologist (optional)" aria-label="Clinical information" className={`${input} w-full`} />
        {billingOn && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bill} onChange={(e) => setBill(e.target.checked)} /> Create an invoice for this study</label>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{chosen ? <>Amount <span className="font-data text-lg">{inr(Math.round(chosen.price * (1 + chosen.gstPercent / 100) * 100) / 100)}</span> <span className="text-xs text-ink/50">incl. GST</span></> : "Choose a study"}</p>
          <button disabled={busy || !patient || !chosen} className={btnPrimary}>{busy ? "Creating..." : "Create order"}</button>
        </div>
        <p className="text-xs text-ink/50">After you place the order you can attach the images or an outside report (JPEG, PNG, WebP or PDF, up to 4 MB each). DICOM files stay in your imaging system.</p>
      </Card>
    </form>
  );
}

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-ink/60">Loading...</p>}><NewImagingOrder /></Suspense>;
}
