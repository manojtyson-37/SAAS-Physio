"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { statusClass } from "@/components/billing/status";
import { api, btnGhost, btnPrimary, fmtDate, input, Notice, paise, PlanBadge, useBillingOn, useCanWriteClinical, useRole, type Msg } from "@/components/dental/ui";
import { toothName } from "@/lib/dental/fdi";
import { PLAN_TRANSITIONS, type PlanStatus } from "@/lib/dental/plan";
import { useIsAdmin } from "@/components/ClinicContext";

type Item = { id: string; tooth: number | null; procedure: string; price: number; gstPercent: number; status: "PLANNED" | "DONE" | "CANCELLED"; doneAt: string | null; invoice: { id: string; number: string; status: string } | null };
type Plan = {
  id: string; patientId: string; title: string; status: PlanStatus; notes: string | null; createdAt: string; billableCount: number;
  patient: { id: string; name: string; uhid: string | null; phone: string } | null; items: Item[];
  totals: { planned: number; done: number; gstDone: number; doneCount: number; plannedCount: number };
};
type Form = { tooth: string; procedure: string; price: string; gstPercent: string };
const blank: Form = { tooth: "", procedure: "", price: "", gstPercent: "0" };
const ACTION: Record<string, string> = { ACCEPTED: "Patient accepted", IN_PROGRESS: "Start treatment", COMPLETED: "Complete plan", CANCELLED: "Cancel plan" };

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const isAdmin = useIsAdmin();
  const { id } = use(params);
  const canWrite = useCanWriteClinical();
  const role = useRole();
  const billingOn = useBillingOn();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState<string | null>(null);

  const load = useCallback(() => api<{ plan: Plan }>(`/api/dental/plans/${id}`).then((r) => { if (r.ok) setPlan(r.data.plan); else setErr(r.error); }), [id]);
  useEffect(() => { load(); }, [load]);

  async function run(p: Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, ok?: string) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return false; }
    if (ok) setMsg({ ok: true, text: ok });
    await load();
    return true;
  }

  if (err) return <div className="space-y-3"><Notice msg={{ ok: false, text: err }} /><Link href="/app/dental" className="text-sm text-forest hover:underline">Back to plans</Link></div>;
  if (!plan) return <p className="text-sm text-ink/50">Loading...</p>;

  const open = plan.status !== "COMPLETED" && plan.status !== "CANCELLED";
  const canDo = plan.status === "ACCEPTED" || plan.status === "IN_PROGRESS";
  const payload = (f: Form) => ({ tooth: f.tooth.trim() ? Number(f.tooth) : null, procedure: f.procedure, price: f.price, gstPercent: f.gstPercent || 0 });

  async function submit() {
    const ok = editing
      ? await run(api(`/api/dental/plans/${id}/items/${editing}`, "PATCH", payload(form)), "Procedure updated.")
      : await run(api(`/api/dental/plans/${id}/items`, "POST", payload(form)), "Procedure added.");
    if (ok) { setForm(blank); setEditing(null); }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/app/dental" className="text-xs text-forest hover:underline">Treatment plans</Link>
            {title === null ? (
              <h1 className="font-display text-3xl">{plan.title} {canWrite && open && <button className="ml-2 text-xs text-forest hover:underline" onClick={() => setTitle(plan.title)}>Rename</button>}</h1>
            ) : (
              <div className="flex gap-2"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Plan title" />
                <button className={btnPrimary} disabled={busy} onClick={async () => { if (await run(api(`/api/dental/plans/${id}`, "PATCH", { title }), "Title updated.")) setTitle(null); }}>Save</button>
                <button className={btnGhost} onClick={() => setTitle(null)}>Cancel</button></div>
            )}
            <p className="mt-1 text-sm text-ink/60">{plan.patient?.name} <span className="font-data text-xs text-ink/50">{plan.patient?.uhid}</span> · created {fmtDate(plan.createdAt)} · <PlanBadge status={plan.status} /></p>
            <p className="mt-1 text-sm"><Link className="text-forest hover:underline" href={`/app/dental/chart/${plan.patientId}`}>Open dental chart</Link></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => window.print()}>Print</button>
            {canWrite && PLAN_TRANSITIONS[plan.status].map((s) => (
              <button key={s} disabled={busy} className={s === "CANCELLED" ? btnGhost : btnPrimary}
                onClick={() => { if (s === "CANCELLED" && !window.confirm("Cancel this plan? Completed procedures can still be billed.")) return; run(api(`/api/dental/plans/${id}`, "PATCH", { status: s }), `Plan is now ${s.toLowerCase().replace("_", " ")}.`); }}>{ACTION[s]}</button>
            ))}
          </div>
        </div>
        <Notice msg={msg} />

        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs text-ink/50"><th className="px-6 py-3">Tooth</th><th>Procedure</th><th>Price</th><th>GST</th><th>Status</th><th /></tr></thead>
            <tbody>
              {plan.items.length === 0 && <tr><td colSpan={6} className="px-6 py-6 text-ink/60">No procedures yet. Add the first one below.</td></tr>}
              {plan.items.map((i) => (
                <tr key={i.id} className={`border-b border-sand/60 last:border-0 ${i.status === "CANCELLED" ? "opacity-50 line-through" : ""}`}>
                  <td className="px-6 py-3 font-data" title={i.tooth ? toothName(i.tooth) : ""}>{i.tooth ?? "-"}</td>
                  <td>{i.procedure}</td>
                  <td className="font-data">{paise(Math.round(i.price * 100))}</td>
                  <td className="font-data">{i.gstPercent}%</td>
                  <td>
                    {i.status === "DONE" ? <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs text-forest">Done{i.doneAt ? ` ${fmtDate(i.doneAt)}` : ""}</span> : i.status === "PLANNED" ? <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs">Planned</span> : <span className="text-xs">Removed</span>}
                    {i.invoice && <Link href={`/app/invoices/${i.invoice.id}`} className={`ml-2 rounded-full px-2 py-0.5 text-xs ${statusClass(i.invoice.status)}`}>{i.invoice.number}</Link>}
                  </td>
                  <td className="space-x-3 px-6 text-right">
                    {canWrite && i.status === "PLANNED" && open && (<>
                      {canDo && <button className="text-forest hover:underline" disabled={busy} onClick={() => run(api(`/api/dental/plans/${id}/items/${i.id}`, "PATCH", { status: "DONE" }), "Marked done.")}>Mark done</button>}
                      <button className="text-forest hover:underline" onClick={() => { setEditing(i.id); setForm({ tooth: i.tooth ? String(i.tooth) : "", procedure: i.procedure, price: String(i.price), gstPercent: String(i.gstPercent) }); }}>Edit</button>
                      {isAdmin && <button className="text-clay hover:underline" disabled={busy} onClick={() => run(api(`/api/dental/plans/${id}/items/${i.id}`, "DELETE"), "Procedure removed.")}>Remove</button>}
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-sand text-sm"><td colSpan={2} className="px-6 py-2 text-ink/60">Pending (incl. GST)</td><td colSpan={4} className="font-data">{paise(plan.totals.planned)}</td></tr>
              <tr className="text-sm"><td colSpan={2} className="px-6 py-2 text-ink/60">Completed (incl. GST {paise(plan.totals.gstDone)})</td><td colSpan={4} className="font-data font-medium">{paise(plan.totals.done)}</td></tr>
            </tfoot>
          </table>
        </Card>

        {billingOn && ["DOCTOR", "CLINIC_ADMIN", "STAFF"].includes(role) && (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/70">{plan.billableCount > 0 ? `${plan.billableCount} completed procedure${plan.billableCount === 1 ? "" : "s"} waiting to be billed.` : "Nothing waiting to be billed. Completed procedures are billed once."}</p>
            <button className={btnPrimary} disabled={busy || plan.billableCount === 0} onClick={() => run(api<{ number: string }>(`/api/dental/plans/${id}/invoice`, "POST"), "Invoice created.")}>Bill completed procedures</button>
          </Card>
        )}

        {canWrite && open && (
          <Card className="space-y-3">
            <h2 className="font-display text-xl">{editing ? "Edit procedure" : "Add procedure"}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
              <input className={`sm:col-span-2 ${input}`} placeholder="Tooth" inputMode="numeric" value={form.tooth} onChange={(e) => setForm({ ...form, tooth: e.target.value })} aria-label="Tooth number" />
              <input className={`col-span-2 sm:col-span-5 ${input}`} placeholder="Procedure *" value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} aria-label="Procedure" />
              <input className={`sm:col-span-3 ${input}`} placeholder="Price *" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} aria-label="Price" />
              <input className={`sm:col-span-2 ${input}`} placeholder="GST %" inputMode="decimal" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} aria-label="GST percent" />
            </div>
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy} onClick={submit}>{editing ? "Save changes" : "Add procedure"}</button>
              {editing && <button className={btnGhost} onClick={() => { setEditing(null); setForm(blank); }}>Cancel edit</button>}
            </div>
          </Card>
        )}
        {plan.notes && <Card><p className="text-sm text-ink/70">{plan.notes}</p></Card>}
      </div>

      {/* Print sheet: only visible when printing */}
      <style>{`@media print { body * { visibility: hidden } #plan-print, #plan-print * { visibility: visible } #plan-print { position: absolute; left: 0; top: 0; width: 100% } }`}</style>
      <div id="plan-print" className="hidden bg-white p-8 text-black print:block">
        <h1 className="text-2xl font-semibold">Treatment plan: {plan.title}</h1>
        <p className="mt-1 text-sm">Patient: {plan.patient?.name} {plan.patient?.uhid ? `(${plan.patient.uhid})` : ""} · {fmtDate(plan.createdAt)} · Status: {plan.status.replace("_", " ").toLowerCase()}</p>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead><tr className="border-b border-black text-left"><th className="py-1">Tooth</th><th>Procedure</th><th className="text-right">Price</th><th className="text-right">GST</th><th>Status</th></tr></thead>
          <tbody>
            {plan.items.filter((i) => i.status !== "CANCELLED").map((i) => (
              <tr key={i.id} className="border-b border-gray-300"><td className="py-1">{i.tooth ?? "-"}</td><td>{i.procedure}</td><td className="text-right">{paise(Math.round(i.price * 100))}</td><td className="text-right">{i.gstPercent}%</td><td>{i.status === "DONE" ? "Done" : "Planned"}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm">Pending (incl. GST): {paise(plan.totals.planned)} · Completed (incl. GST): {paise(plan.totals.done)}</p>
        {plan.notes && <p className="mt-2 text-sm">Notes: {plan.notes}</p>}
      </div>
    </div>
  );
}
