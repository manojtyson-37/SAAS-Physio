"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { statusClass } from "@/components/billing/status";
import { StatusBadge, when } from "@/components/lab/shared";
import { api, btnGhost, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";
import ImagingAttachments from "@/components/radiology/ImagingAttachments";
import { MODALITY_LABEL, type Modality } from "@/lib/radiology/logic";

type Order = {
  id: string; orderNo: string; status: string; studyName: string; modality: Modality; bodyPart: string | null; price: number; gstPercent: number; clinicalInfo: string | null;
  createdAt: string; scheduledAt: string | null; performedAt: string | null; reportedAt: string | null; findings: string | null; impression: string | null;
  orderedBy: string | null; performedBy: string | null; reportedBy: string | null; patient: { id: string; name: string; uhid: string | null };
  invoice: { id: string; number: string; status: string } | null; cancelReason: string | null; amendments: { at: string; by: string | null }[];
};

/** `datetime-local` value (India wall clock) for a given instant. */
const toLocalInput = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);
};

export default function ImagingOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [sched, setSched] = useState<string | null>(null);
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [editingReport, setEditingReport] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const load = () => api<{ order: Order }>(`/api/radiology/orders/${id}`).then((r) => {
    if (!r.ok) return setMissing(true);
    setO(r.data.order);
    setFindings(r.data.order.findings ?? "");
    setImpression(r.data.order.impression ?? "");
  });
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (missing) return <Card><p className="text-sm">Imaging order not found. <Link href="/app/radiology" className="text-forest underline">Back to radiology</Link></p></Card>;
  if (!o) return <p className="text-sm text-ink/60">Loading...</p>;

  async function act(path: string, method: string, body: unknown, ok: string) {
    setBusy(true);
    setMsg(null);
    const r = await api<{ note?: string }>(`/api/radiology/orders/${id}/${path}`, method, body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: r.data.note ?? ok });
    setSched(null); setCancelling(false); setEditingReport(false);
    await load();
  }
  async function saveInfo() {
    const r = await api(`/api/radiology/orders/${id}`, "PATCH", { clinicalInfo: info ?? "" });
    setMsg(r.ok ? { ok: true, text: "Clinical information saved" } : { ok: false, text: r.error });
    if (r.ok) { setInfo(null); await load(); }
  }
  const open = o.status !== "CANCELLED" && o.status !== "REPORTED";
  const showEditor = o.status === "PERFORMED" || editingReport;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/radiology" className="text-sm text-forest hover:underline">Back to radiology</Link>
          <h1 className="mt-2 font-display text-3xl"><span className="font-data">{o.orderNo}</span> <StatusBadge status={o.status} /></h1>
          <p className="mt-1 text-sm text-ink/60">
            {o.studyName} · {MODALITY_LABEL[o.modality] ?? o.modality}{o.bodyPart ? ` · ${o.bodyPart}` : ""} ·{" "}
            <Link href={`/app/patients/${o.patient.id}`} className="text-forest hover:underline">{o.patient.name}</Link> <span className="font-data text-xs">{o.patient.uhid}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(o.status === "ORDERED" || o.status === "SCHEDULED") && <button onClick={() => setSched(toLocalInput(o.scheduledAt))} className={btnGhost}>{o.status === "SCHEDULED" ? "Reschedule" : "Schedule"}</button>}
          {(o.status === "ORDERED" || o.status === "SCHEDULED") && <button disabled={busy} onClick={() => act("perform", "POST", undefined, "Marked as performed")} className={btnPrimary}>Mark performed</button>}
          {o.status === "REPORTED" && <Link href={`/app/radiology/${o.id}/report`} className={btnPrimary}>Print report</Link>}
          {o.status === "REPORTED" && !editingReport && <button onClick={() => setEditingReport(true)} className={btnGhost}>Correct report</button>}
          {open && <button onClick={() => setCancelling(true)} className={btnGhost}>Cancel order</button>}
        </div>
      </div>
      <Notice msg={msg} />
      {o.status === "CANCELLED" && <Card><p className="text-sm text-clay">Cancelled{o.cancelReason ? `: ${o.cancelReason}` : ""}</p></Card>}

      {sched !== null && (
        <Card className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Date and time (India)<input type="datetime-local" value={sched} onChange={(e) => setSched(e.target.value)} className={`${input} ml-2`} /></label>
          <button disabled={busy || !sched} onClick={() => act("schedule", "POST", { scheduledAt: new Date(`${sched}:00+05:30`).toISOString() }, "Scheduled")} className={btnPrimary}>Save</button>
          <button onClick={() => setSched(null)} className={btnGhost}>Close</button>
        </Card>
      )}
      {cancelling && (
        <Card className="space-y-3">
          <p className="text-sm">Cancel this order? An unpaid invoice is cancelled with it. If the invoice has payments the cancel is refused.</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason" className={`${input} w-full`} />
          <div className="flex gap-2">
            <button disabled={busy || reason.trim().length < 3} onClick={() => act("cancel", "POST", { reason }, "Order cancelled")} className={btnPrimary}>Confirm cancel</button>
            <button onClick={() => setCancelling(false)} className={btnGhost}>Keep order</button>
          </div>
        </Card>
      )}

      {showEditor ? (
        <Card className="space-y-3">
          <h2 className="font-display text-xl">{o.status === "REPORTED" ? "Correct the report" : "Report"}</h2>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={8} maxLength={8000} placeholder="Findings" aria-label="Findings" className={`${input} w-full`} />
          <textarea value={impression} onChange={(e) => setImpression(e.target.value)} rows={3} maxLength={2000} placeholder="Impression" aria-label="Impression" className={`${input} w-full`} />
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy || findings.trim().length < 3} onClick={() => act("report", "PUT", { findings, impression: impression || null }, "Report saved")} className={btnPrimary}>{o.status === "REPORTED" ? "Save correction" : "Finalise report"}</button>
            {editingReport && <button onClick={() => setEditingReport(false)} className={btnGhost}>Cancel</button>}
            <span className="text-xs text-ink/50">Only doctors and clinic admins can report. {o.status === "REPORTED" ? "The previous text is kept in the audit log." : ""}</span>
          </div>
        </Card>
      ) : o.status === "REPORTED" ? (
        <Card className="space-y-3">
          <h2 className="font-display text-xl">Report</h2>
          <div><p className="font-data text-[11px] uppercase tracking-widest text-ink/40">Findings</p><p className="whitespace-pre-wrap text-sm">{o.findings}</p></div>
          {o.impression && <div><p className="font-data text-[11px] uppercase tracking-widest text-ink/40">Impression</p><p className="whitespace-pre-wrap text-sm font-medium">{o.impression}</p></div>}
          <p className="text-xs text-ink/50">Reported {when(o.reportedAt)}{o.reportedBy ? ` by ${o.reportedBy}` : ""}{o.amendments.length > 0 ? ` · corrected ${o.amendments.length} time${o.amendments.length === 1 ? "" : "s"}` : ""}</p>
        </Card>
      ) : null}

      <ImagingAttachments orderId={o.id} canUpload={o.status !== "CANCELLED"} />

      <Card className="space-y-2">
        <h2 className="font-display text-xl">Order details</h2>
        <p className="text-sm text-ink/70">Amount <span className="font-data">{inr(Math.round(o.price * (1 + o.gstPercent / 100) * 100) / 100)}</span> (incl. GST)</p>
        {o.invoice ? <p className="text-sm">Invoice <Link href={`/app/invoices/${o.invoice.id}`} className="font-data text-forest underline">{o.invoice.number}</Link> <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${statusClass(o.invoice.status)}`}>{o.invoice.status}</span></p> : <p className="text-sm text-ink/50">Not billed</p>}
        <p className="text-sm text-ink/70">Ordered {when(o.createdAt)}{o.orderedBy ? ` by ${o.orderedBy}` : ""}</p>
        {o.scheduledAt && <p className="text-sm text-ink/70">Scheduled {when(o.scheduledAt)}</p>}
        {o.performedAt && <p className="text-sm text-ink/70">Performed {when(o.performedAt)}</p>}
        <div className="pt-2">
          <p className="font-data text-[11px] uppercase tracking-widest text-ink/40">Clinical information</p>
          {info === null ? (
            <p className="text-sm">{o.clinicalInfo || <span className="text-ink/40">None</span>} {o.status !== "CANCELLED" && <button onClick={() => setInfo(o.clinicalInfo ?? "")} className="ml-2 text-forest hover:underline">Edit</button>}</p>
          ) : (
            <div className="space-y-2">
              <textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={2} maxLength={500} aria-label="Clinical information" className={`${input} w-full`} />
              <div className="flex gap-2"><button onClick={saveInfo} className={btnPrimary}>Save</button><button onClick={() => setInfo(null)} className={btnGhost}>Cancel</button></div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
