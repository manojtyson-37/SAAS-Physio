"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { CredentialsCard, fmtDate, fmtDateTime, StateBadge, stateDetail, type Creds, type Sub } from "@/components/platform/ui";
import { api, btnGhost, btnPrimary, input, Notice, type Msg } from "@/components/pharmacy/ui";
import { DEFAULT_TRIAL_DAYS, MAX_EXTEND_DAYS, MAX_TRIAL_DAYS, PLANS } from "@/lib/platform/subscription";

type Clinic = { id: string; name: string; clinicTypeLabel: string; phone: string | null; email: string | null; address: string | null; gstNumber: string | null; subscription: Sub; modules: string[]; selfServiceModules: boolean };
type Admin = { id: string; name: string; email: string; isActive: boolean; mustChangePassword: boolean };
type Hist = { id: string; at: string; entity: string; action: string; detail: unknown; by: string | null };
type Detail = { clinic: Clinic; admins: Admin[]; owner: boolean; patientCount: number; userCount: number; history: Hist[] };
type Mod = { key: string; label: string; description: string; group: string; requires: string[] };

const ENTITY: Record<string, string> = { Clinic: "Clinic details", Subscription: "Subscription", ClinicModules: "Modules", ClinicAdminPassword: "Admin password" };
const summarize = (d: unknown) => {
  if (!d || typeof d !== "object") return "";
  const o = d as Record<string, unknown>;
  if (typeof o.action === "string") return o.action.replace(/_/g, " ");
  if (Array.isArray(o.fields)) return `changed ${o.fields.join(", ")}`;
  if (Array.isArray(o.before) && Array.isArray(o.after)) return `modules ${o.before.length} to ${o.after.length}`;
  return "";
};

export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [mods, setMods] = useState<Mod[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);

  const load = useCallback(() => api<Detail>(`/api/platform/clinics/${id}`).then((r) => (r.ok ? setD(r.data) : setErr(r.error))), [id]);
  useEffect(() => { load(); api<{ modules: Mod[] }>(`/api/platform/clinics/${id}/modules`).then((r) => { if (r.ok) setMods(r.data.modules); }); }, [id, load]);
  useEffect(() => () => setCreds(null), []);

  if (err) return <div className="space-y-4"><Link href="/app/platform" className="text-sm text-forest hover:underline">Back to clinics</Link><Notice msg={{ ok: false, text: err }} /></div>;
  if (!d) return <p className="text-sm text-ink/50">Loading...</p>;
  const c = d.clinic;

  return (
    <div className="space-y-6">
      <Link href="/app/platform" className="text-sm text-forest hover:underline">Back to clinics</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">{c.name}</h1>
        <StateBadge state={c.subscription.state} />
        <span className="text-sm text-ink/50">{stateDetail(c.subscription)}</span>
      </div>
      <p className="text-sm text-ink/60">{c.clinicTypeLabel} · {d.patientCount} patients · {d.userCount} users</p>
      {creds && <CredentialsCard creds={creds} onClose={() => setCreds(null)} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <SubscriptionCard id={id} c={c} owner={d.owner} onDone={load} />
        <DetailsCard id={id} c={c} onDone={load} />
      </div>
      <ModulesCard id={id} c={c} mods={mods} onDone={load} />
      <AdminsCard id={id} admins={d.admins} clinicName={c.name} onCreds={setCreds} />
      <Card>
        <h2 className="font-display text-xl">History</h2>
        {d.history.length === 0 ? <p className="mt-2 text-sm text-ink/60">Nothing recorded yet.</p> : (
          <ul className="mt-3 divide-y divide-sand/60 text-sm">
            {d.history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{ENTITY[h.entity] ?? h.entity} · {h.action.toLowerCase()} {summarize(h.detail) && <span className="text-ink/50">({summarize(h.detail)})</span>}</span>
                <span className="text-xs text-ink/50">{h.by ?? "System"} · {fmtDateTime(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SubscriptionCard({ id, c, owner, onDone }: { id: string; c: Clinic; owner: boolean; onDone: () => void }) {
  const s = c.subscription;
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [trialDays, setTrialDays] = useState(String(DEFAULT_TRIAL_DAYS));
  const [extDays, setExtDays] = useState("7");
  const [plan, setPlan] = useState(s.plan ?? "STARTER");
  const [paidThrough, setPaidThrough] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");

  async function run(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setMsg(null);
    const r = await api(`/api/platform/clinics/${id}/subscription`, "POST", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Subscription updated" }); setNote(""); onDone();
  }
  const row = "flex flex-wrap items-end gap-2";

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-xl">Subscription</h2>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-ink/50">State</dt><dd><StateBadge state={s.state} /></dd>
        <dt className="text-ink/50">Plan</dt><dd>{s.plan ?? "Not set"}</dd>
        <dt className="text-ink/50">Trial started</dt><dd>{fmtDate(s.trialStartedAt)}</dd>
        <dt className="text-ink/50">Trial ends</dt><dd>{fmtDate(s.trialEndsAt)}</dd>
        <dt className="text-ink/50">Paid through</dt><dd>{fmtDate(s.paidThrough)}</dd>
        <dt className="text-ink/50">Access</dt><dd>{s.access === "FULL" ? "Full" : s.access === "READ_ONLY" ? "Read-only" : "Blocked"}</dd>
        {s.note && <><dt className="text-ink/50">Note</dt><dd>{s.note}</dd></>}
      </dl>
      <Notice msg={msg} />
      <div className={row}>
        <label className="flex flex-col gap-1 text-xs">Trial days<input type="number" min={1} max={MAX_TRIAL_DAYS} className={`${input} w-24`} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} /></label>
        <button disabled={busy} className={btnGhost} onClick={() => run({ action: "start_trial", days: Number(trialDays) }, "Start a new trial from today?")}>Start trial</button>
      </div>
      <div className={row}>
        <label className="flex flex-col gap-1 text-xs">Extend by (1 to {MAX_EXTEND_DAYS})<input type="number" min={1} max={MAX_EXTEND_DAYS} className={`${input} w-24`} value={extDays} onChange={(e) => setExtDays(e.target.value)} /></label>
        <button disabled={busy} className={btnGhost} onClick={() => run({ action: "extend_trial", days: Number(extDays) })}>Extend trial</button>
      </div>
      <div className={row}>
        <label className="flex flex-col gap-1 text-xs">Plan<select className={input} value={plan} onChange={(e) => setPlan(e.target.value)}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select></label>
        <button disabled={busy} className={btnGhost} onClick={() => run({ action: "set_plan", plan })}>Set plan</button>
        {owner && (
          <>
            <label className="flex flex-col gap-1 text-xs">Paid through<input type="date" className={input} value={paidThrough} onChange={(e) => setPaidThrough(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-xs">Amount received (₹)<input type="number" min={0} step="0.01" className={`${input} w-32`} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-xs">Payment method<select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>{["Bank transfer", "UPI", "Cash", "Card", "Cheque"].map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-xs">Reference<input maxLength={100} className={`${input} w-40`} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
            <button disabled={busy} className={btnPrimary} onClick={() => run({ action: "activate", plan, ...(paidThrough ? { paidThrough } : {}), ...(amount ? { amount: Number(amount), method, ...(reference.trim() ? { reference: reference.trim() } : {}) } : {}) }, `Activate ${plan}${paidThrough ? ` until ${paidThrough}` : " with no end date"}${amount ? ` and record a payment of ₹${amount}` : ""}?`)}>Activate</button>
          </>
        )}
      </div>
      {owner && (
        <div className="space-y-2 border-t border-sand pt-3">
          <label className="flex flex-col gap-1 text-xs">Note for suspend, cancel (optional)<input maxLength={300} className={input} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className={btnGhost} onClick={() => run({ action: "suspend", note }, `Suspend ${c.name}? Its users are blocked until reactivated.`)}>Suspend</button>
            <button disabled={busy} className={btnGhost} onClick={() => run({ action: "reactivate" }, `Reactivate ${c.name}?`)}>Reactivate</button>
            <button disabled={busy} className={btnGhost} onClick={() => run({ action: "cancel", note }, `Cancel the subscription of ${c.name}? Its records become read-only.`)}>Cancel subscription</button>
          </div>
        </div>
      )}
      {!owner && <p className="text-xs text-ink/50">Activating, suspending, reactivating and cancelling are done by the platform owner.</p>}
    </Card>
  );
}

function DetailsCard({ id, c, onDone }: { id: string; c: Clinic; onDone: () => void }) {
  const [f, setF] = useState({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", gstNumber: c.gstNumber ?? "" });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await api(`/api/platform/clinics/${id}`, "PATCH", f);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Details saved" }); onDone();
  }
  return (
    <Card>
      <h2 className="font-display text-xl">Details</h2>
      <form onSubmit={save} className="mt-3 space-y-3">
        <label className="flex flex-col gap-1 text-sm">Name<input required minLength={2} maxLength={120} className={input} value={f.name} onChange={set("name")} /></label>
        <label className="flex flex-col gap-1 text-sm">Phone<input maxLength={30} className={input} value={f.phone} onChange={set("phone")} /></label>
        <label className="flex flex-col gap-1 text-sm">Email<input type="email" maxLength={120} className={input} value={f.email} onChange={set("email")} /></label>
        <label className="flex flex-col gap-1 text-sm">Address<input maxLength={300} className={input} value={f.address} onChange={set("address")} /></label>
        <label className="flex flex-col gap-1 text-sm">GST number<input maxLength={20} className={input} value={f.gstNumber} onChange={set("gstNumber")} /></label>
        <Notice msg={msg} />
        <button disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save details"}</button>
      </form>
    </Card>
  );
}

function ModulesCard({ id, c, mods, onDone }: { id: string; c: Clinic; mods: Mod[]; onDone: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set(c.modules));
  const [self, setSelf] = useState(c.selfServiceModules);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (k: string) => setSel((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const groups = Array.from(new Set(mods.map((m) => m.group)));
  async function save() {
    setBusy(true); setMsg(null);
    const r = await api<{ enabled: string[]; selfService: boolean }>(`/api/platform/clinics/${id}/modules`, "PUT", { modules: Array.from(sel), selfService: self });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setSel(new Set(r.data.enabled)); setSelf(r.data.selfService);
    setMsg({ ok: true, text: "Modules saved. Required modules were added automatically." }); onDone();
  }
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-display text-xl">Modules</h2>
        <p className="mt-1 text-xs text-ink/50">Pharmacy needs inventory and discharge needs IPD; they are added automatically. Switching a module off hides it but never deletes data.</p>
      </div>
      {mods.length === 0 ? <p className="text-sm text-ink/50">Loading modules...</p> : groups.map((g) => (
        <div key={g}>
          <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">{g}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {mods.filter((m) => m.group === g).map((m) => (
              <label key={m.key} className="flex items-start gap-2 rounded-lg border border-sand p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={sel.has(m.key)} onChange={() => toggle(m.key)} />
                <span><span className="font-medium">{m.label}</span>{m.requires.length > 0 && <span className="ml-1 text-xs text-ink/50">(needs {m.requires.join(", ")})</span>}<span className="block text-xs text-ink/50">{m.description}</span></span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={self} onChange={(e) => setSelf(e.target.checked)} />Clinic admin may change modules themselves</label>
      <Notice msg={msg} />
      <button disabled={busy || mods.length === 0} className={btnPrimary} onClick={save}>{busy ? "Saving..." : "Save modules"}</button>
    </Card>
  );
}

function AdminsCard({ id, admins, clinicName, onCreds }: { id: string; admins: Admin[]; clinicName: string; onCreds: (c: Creds) => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function reset(a: Admin) {
    if (!window.confirm(`Reset the password of ${a.name}? Their current password stops working.`)) return;
    setBusy(a.id); setMsg(null);
    const r = await api<{ tempPassword: string }>(`/api/platform/clinics/${id}/admins/${a.id}/reset-password`, "POST");
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    onCreds({ title: "Password reset", lines: [{ label: "Clinic", value: clinicName }, { label: "Admin", value: a.name }, { label: "Admin email", value: a.email }], password: r.data.tempPassword });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl">Clinic admins</h2>
      <Notice msg={msg} />
      {admins.length === 0 ? <p className="text-sm text-ink/60">This clinic has no admin.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b border-sand/60 last:border-0">
                <td className="py-2 pr-4">{a.name}<div className="text-xs text-ink/50">{a.email}</div></td>
                <td className="py-2 pr-4 text-xs text-ink/60">{a.isActive ? "Active" : "Inactive"}{a.mustChangePassword ? " · must change password" : ""}</td>
                <td className="py-2 text-right"><button disabled={busy === a.id} className={btnGhost} onClick={() => reset(a)}>Reset password</button></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </Card>
  );
}
