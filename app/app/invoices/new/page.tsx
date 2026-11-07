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
      fetch(`/api/patients?q=${encodeURIComponent(q.trim())}`)
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
