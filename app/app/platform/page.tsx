"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { CredentialsCard, fmtDate, STATE_LABEL, StateBadge, stateDetail, type Creds, type Sub } from "@/components/platform/ui";
import { api, btnGhost, btnPrimary, input, Notice, type Msg } from "@/components/pharmacy/ui";
import { CLINIC_TYPE_KEYS, CLINIC_TYPES } from "@/lib/modules/clinicTypes";
import { DEFAULT_TRIAL_DAYS, MAX_TRIAL_DAYS, PLANS } from "@/lib/platform/subscription";

type Row = { id: string; name: string; clinicType: string; clinicTypeLabel: string; createdAt: string; subscription: Sub; modules: string[]; patientCount: number; userCount: number };
const blank = { name: "", clinicType: "PHYSIOTHERAPY", phone: "", email: "", address: "", gstNumber: "", adminName: "", adminEmail: "", trialDays: String(DEFAULT_TRIAL_DAYS), plan: "" };

export default function PlatformPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [q, setQ] = useState("");
  const [stateF, setStateF] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<Creds | null>(null);

  const load = () => api<{ clinics: Row[] }>("/api/platform/clinics").then((r) => (r.ok ? setRows(r.data.clinics) : setMsg({ ok: false, text: r.error })));
  useEffect(() => { load(); }, []);
  useEffect(() => () => setCreds(null), []);

  const shown = useMemo(() => (rows ?? []).filter((r) =>
    (!stateF || r.subscription.state === stateF) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, stateF]);

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body = { ...f, trialDays: Number(f.trialDays), plan: f.plan || undefined };
    const r = await api<{ clinic: { id: string; name: string }; admin: { name: string; email: string }; tempPassword: string }>("/api/platform/clinics", "POST", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setCreds({ title: "Clinic created", lines: [{ label: "Clinic", value: r.data.clinic.name }, { label: "Admin", value: r.data.admin.name }, { label: "Admin email", value: r.data.admin.email }], password: r.data.tempPassword });
    setF(blank); setShowForm(false); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Clinics</h1>
          <p className="mt-1 text-sm text-ink/60">Every clinic on the platform, its subscription and modules.</p>
        </div>
        <button className={btnPrimary} onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "Onboard a clinic"}</button>
      </div>
      <Notice msg={msg} />
      {creds && <CredentialsCard creds={creds} onClose={() => setCreds(null)} />}

      {showForm && (
        <Card>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">Clinic name *<input required minLength={2} maxLength={120} className={input} value={f.name} onChange={set("name")} /></label>
            <label className="flex flex-col gap-1 text-sm">Clinic type *
              <select className={input} value={f.clinicType} onChange={set("clinicType")}>
                {CLINIC_TYPE_KEYS.map((k) => <option key={k} value={k}>{CLINIC_TYPES[k].label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Phone<input maxLength={30} className={input} value={f.phone} onChange={set("phone")} /></label>
            <label className="flex flex-col gap-1 text-sm">Clinic email<input type="email" maxLength={120} className={input} value={f.email} onChange={set("email")} /></label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">Address<input maxLength={300} className={input} value={f.address} onChange={set("address")} /></label>
            <label className="flex flex-col gap-1 text-sm">GST number<input maxLength={20} className={input} value={f.gstNumber} onChange={set("gstNumber")} /></label>
            <label className="flex flex-col gap-1 text-sm">Plan
              <select className={input} value={f.plan} onChange={set("plan")}><option value="">Not set</option>{PLANS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Admin name *<input required minLength={2} maxLength={100} className={input} value={f.adminName} onChange={set("adminName")} /></label>
            <label className="flex flex-col gap-1 text-sm">Admin email *<input required type="email" maxLength={120} className={input} value={f.adminEmail} onChange={set("adminEmail")} /></label>
            <label className="flex flex-col gap-1 text-sm">Trial days (1 to {MAX_TRIAL_DAYS})<input type="number" min={1} max={MAX_TRIAL_DAYS} className={input} value={f.trialDays} onChange={set("trialDays")} /></label>
            <div className="flex items-end sm:col-span-2"><button disabled={busy} className={btnPrimary}>{busy ? "Creating..." : "Create clinic and admin"}</button></div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <input className={`${input} w-64 max-w-full`} placeholder="Search clinics" aria-label="Search clinics" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} aria-label="Filter by state" value={stateF} onChange={(e) => setStateF(e.target.value)}>
          <option value="">All states</option>
          {Object.entries(STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(q || stateF) && <button className={btnGhost} onClick={() => { setQ(""); setStateF(""); }}>Clear</button>}
      </div>

      {rows === null && !msg ? <p className="text-sm text-ink/50">Loading...</p> : rows && shown.length === 0 ? (
        <Card><p className="text-sm text-ink/60">{rows.length === 0 ? "No clinics yet. Use Onboard a clinic to add the first one." : "No clinics match this filter."}</p></Card>
      ) : rows && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left font-data text-[10px] uppercase tracking-widest text-ink/40">
              <th className="px-4 py-3">Clinic</th><th className="px-4 py-3">Subscription</th><th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Modules</th><th className="px-4 py-3 text-right">Patients</th><th className="px-4 py-3">Created</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/app/platform/${r.id}`)} className="cursor-pointer border-b border-sand/60 last:border-0 hover:bg-forest/5">
                  <td className="px-4 py-3"><Link href={`/app/platform/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-forest hover:underline">{r.name}</Link><div className="text-xs text-ink/50">{r.clinicTypeLabel}</div></td>
                  <td className="px-4 py-3"><StateBadge state={r.subscription.state} /><span className="ml-2 text-xs text-ink/50">{stateDetail(r.subscription)}</span></td>
                  <td className="px-4 py-3 text-ink/70">{r.subscription.plan ?? "Not set"}</td>
                  <td className="px-4 py-3 text-right font-data">{r.modules.length}</td>
                  <td className="px-4 py-3 text-right font-data">{r.patientCount}</td>
                  <td className="px-4 py-3 text-xs text-ink/50">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
