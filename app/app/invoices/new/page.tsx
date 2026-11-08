"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import InvoiceForm, { emptyLine, FormValue } from "@/components/billing/InvoiceForm";

type PatientHit = { id: string; name: string; phone: string; uhid: string | null };

function NewInvoice() {
  const router = useRouter();
  const sp = useSearchParams();
  const visitId = sp.get("visitId") ?? undefined;
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [q, setQ] = useState("");
  const [found, setHits] = useState<PatientHit[]>([]);
  const hits = q.trim().length < 2 ? [] : found;
  const [form, setForm] = useState<FormValue>({ lines: [emptyLine()], discount: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [np, setNp] = useState({ name: "", phone: "", gender: "" });
  const [npErr, setNpErr] = useState<string | null>(null);
  const [npBusy, setNpBusy] = useState(false);

  async function addPatient(e: React.FormEvent) {
    e.preventDefault();
    setNpBusy(true);
    setNpErr(null);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: np.name.trim(), phone: np.phone.trim(), gender: np.gender || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) return setNpErr("Only reception or the clinic admin can add patients. Ask them to add this patient first.");
      if (!res.ok) return setNpErr(data.error ?? "Could not add the patient");
      const p = data.patient;
      setPatient({ id: p.id, name: p.name, phone: p.phone, uhid: p.uhid ?? null });
      setAdding(false);
      setNp({ name: "", phone: "", gender: "" });
      setQ("");
    } catch {
      setNpErr("Could not reach the server. Check your connection and try again.");
    } finally {
      setNpBusy(false);
    }
  }

  // Prefill the patient when arriving from a visit.
  useEffect(() => {
    const pid = sp.get("patientId");
    if (!pid) return;
    fetch(`/api/patients/${pid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.patient && setPatient({ id: d.patient.id, name: d.patient.name, phone: d.patient.phone, uhid: d.patient.uhid ?? null }));
  }, [sp]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/patients?limit=6&q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setHits((d.patients ?? []).slice(0, 6)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function submit() {
    if (!patient) return setError("Choose a patient first");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          visitId,
          lineItems: form.lines,
          discount: form.discount || 0,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Could not create the invoice");
      router.push(`/app/invoices/${data.invoice.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/app/invoices" className="text-sm text-ink/50 hover:text-ink">← All invoices</Link>
      <h1 className="font-display text-3xl">New invoice</h1>
      <Card className="space-y-5">
        <div>
          <p className="text-xs text-ink/60">Patient*</p>
          {patient ? (
            <div className="mt-1 flex items-center gap-3">
              <span className="font-medium">{patient.name}</span>
              <span className="font-data text-xs text-ink/50">{patient.uhid ?? ""} {patient.phone}</span>
              {!visitId && (
                <button onClick={() => setPatient(null)} className="text-xs text-forest hover:underline">Change</button>
              )}
              {visitId && <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink/60">linked to today&apos;s visit</span>}
            </div>
          ) : (
            <div className="relative mt-1 max-w-sm">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone or UHID"
                className="w-full rounded-lg border border-sand px-3 py-2 text-sm"
              />
              {hits.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-sand bg-white shadow">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => { setPatient(h); setHits([]); setQ(""); }}
                        className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-sand/40"
                      >
                        <span>{h.name}</span>
                        <span className="font-data text-xs text-ink/50">{h.uhid ?? h.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!adding && (
                <button type="button" onClick={() => { setAdding(true); setNp({ name: /^\d+$/.test(q.trim()) ? "" : q.trim(), phone: /^\d+$/.test(q.trim()) ? q.trim() : "", gender: "" }); }} className="mt-2 text-sm text-forest hover:underline">
                  + New patient{q.trim().length >= 2 && hits.length === 0 ? ` “${q.trim()}”` : ""}
                </button>
              )}
              {adding && (
                <form onSubmit={addPatient} className="mt-2 grid gap-2 rounded-lg border border-sand bg-white p-3 sm:w-[28rem] sm:grid-cols-2">
                  <input autoFocus required aria-label="Patient name" placeholder="Full name*" maxLength={120} value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
                  <input required aria-label="Phone" placeholder="Phone*" inputMode="tel" minLength={5} maxLength={20} value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
                  <select aria-label="Gender" value={np.gender} onChange={(e) => setNp({ ...np, gender: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm">
                    <option value="">Gender (optional)</option><option>Female</option><option>Male</option><option>Other</option>
                  </select>
                  <div className="flex items-center gap-3">
                    <button disabled={npBusy} className="rounded-lg bg-forest px-4 py-2 text-sm text-cream disabled:opacity-60">{npBusy ? "Adding…" : "Add & select"}</button>
                    <button type="button" onClick={() => setAdding(false)} className="text-sm text-ink/60 hover:underline">Cancel</button>
                  </div>
                  {npErr && <p role="alert" className="text-sm text-clay sm:col-span-2">{npErr}</p>}
                  <p className="text-xs text-ink/50 sm:col-span-2">Full details (DOB, allergies…) can be added later from Patients.</p>
                </form>
              )}
            </div>
          )}
        </div>
        <InvoiceForm value={form} onChange={setForm} onSubmit={submit} submitLabel="Create invoice" saving={saving} error={error} />
      </Card>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink/50">Loading…</p>}>
      <NewInvoice />
    </Suspense>
  );
}
