"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { useHasModule } from "@/components/ClinicContext";
import { newRef, PatientPicker, type PickPatient } from "@/components/lab/shared";
import { api, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";

type Test = { id: string; name: string; category: string; price: number; gstPercent: number; unit: string | null; range: string; sampleType: string | null };

function NewLabOrder() {
  const router = useRouter();
  const sp = useSearchParams();
  const billingOn = useHasModule("billing");
  const [patient, setPatient] = useState<PickPatient | null>(null);
  const [tests, setTests] = useState<Test[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [notes, setNotes] = useState("");
  const [bill, setBill] = useState(true);
  const [ref] = useState(newRef);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const preId = sp.get("patientId");
  const visitId = sp.get("visitId") || undefined;

  useEffect(() => {
    api<{ tests: Test[] }>("/api/lab/tests").then((r) => (r.ok ? setTests(r.data.tests) : (setTests([]), setMsg({ ok: false, text: r.error }))));
  }, []);
  useEffect(() => {
    if (!preId) return;
    api<{ patient: PickPatient }>(`/api/patients/${preId}`).then((r) => { if (r.ok) setPatient(r.data.patient); });
  }, [preId]);

  const shown = useMemo(() => (tests ?? []).filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase())), [tests, q]);
  const groups = useMemo(() => {
    const m = new Map<string, Test[]>();
    for (const t of shown) m.set(t.category, [...(m.get(t.category) ?? []), t]);
    return [...m.entries()];
  }, [shown]);
  const chosen = (tests ?? []).filter((t) => picked.has(t.id));
  const total = chosen.reduce((s, t) => s + t.price * (1 + t.gstPercent / 100), 0);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || chosen.length === 0) return;
    setBusy(true);
    setMsg(null);
    const r = await api<{ id: string }>("/api/lab/orders", "POST", { patientId: patient.id, testIds: chosen.map((t) => t.id), clinicalNotes: notes || undefined, bill: billingOn && bill, visitId, clientRef: ref });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    router.push(`/app/lab/${r.data.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Link href="/app/lab" className="text-sm text-forest hover:underline">Back to laboratory</Link>
        <h1 className="mt-2 font-display text-3xl">New lab order</h1>
      </div>
      <Notice msg={msg} />
      <Card className="space-y-3">
        <h2 className="font-display text-xl">Patient</h2>
        <PatientPicker value={patient} onChange={setPatient} />
      </Card>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Tests</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tests" aria-label="Filter tests" className={`${input} w-56`} />
        </div>
        {tests === null ? <p className="text-sm text-ink/60">Loading...</p> : tests.length === 0 ? (
          <p className="text-sm text-ink/60">The test catalogue is empty. <Link href="/app/lab/tests" className="text-forest underline">Add tests or load the starter set</Link>.</p>
        ) : groups.length === 0 ? <p className="text-sm text-ink/60">No test matches that filter.</p> : groups.map(([cat, list]) => (
          <div key={cat}>
            <h3 className="font-data text-[11px] uppercase tracking-widest text-ink/40">{cat}</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <label key={t.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${picked.has(t.id) ? "border-forest bg-forest/5" : "border-sand"}`}>
                  <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} className="mt-1" />
                  <span className="flex-1">{t.name}<span className="block text-xs text-ink/50">{t.sampleType}</span></span>
                  <span className="font-data text-xs">{inr(t.price)}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <Card className="space-y-3">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} placeholder="Clinical notes (optional)" aria-label="Clinical notes" className={`${input} w-full`} />
        {billingOn && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bill} onChange={(e) => setBill(e.target.checked)} /> Create an invoice for these tests</label>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{chosen.length} test{chosen.length === 1 ? "" : "s"} · <span className="font-data text-lg">{inr(Math.round(total * 100) / 100)}</span> <span className="text-xs text-ink/50">incl. GST</span></p>
          <button disabled={busy || !patient || chosen.length === 0} className={btnPrimary}>{busy ? "Creating..." : "Create order"}</button>
        </div>
      </Card>
    </form>
  );
}

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-ink/60">Loading...</p>}><NewLabOrder /></Suspense>;
}
