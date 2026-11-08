"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { statusClass } from "@/components/billing/status";
import { FlagBadge, StatusBadge, when } from "@/components/lab/shared";
import { api, btnGhost, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";
import { flagResult, parseNumeric } from "@/lib/lab/logic";

type Item = { id: string; testName: string; unit: string | null; refLow: number | null; refHigh: number | null; range: string; price: number; resultValue: string | null; flag: string | null; remarks: string | null };
type Order = {
  id: string; orderNo: string; status: string; clinicalNotes: string | null; createdAt: string; collectedAt: string | null; resultedAt: string | null; orderedBy: string | null;
  patient: { id: string; name: string; uhid: string | null; phone: string }; invoice: { id: string; number: string; status: string } | null; total: number;
  cancelReason: string | null; items: Item[];
  amendments: { at: string; by: string | null; changes: { test: string; from: string | null; to: string }[] }[];
};
type Draft = { value: string; flag: string; remarks: string };

export default function LabOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<string | null>(null);

  const load = () => api<{ order: Order }>(`/api/lab/orders/${id}`).then((r) => {
    if (!r.ok) return setMissing(true);
    setO(r.data.order);
    setDraft(Object.fromEntries(r.data.order.items.map((i) => [i.id, { value: i.resultValue ?? "", flag: "", remarks: i.remarks ?? "" }])));
  });
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (missing) return <Card><p className="text-sm">Lab order not found. <Link href="/app/lab" className="text-forest underline">Back to laboratory</Link></p></Card>;
  if (!o) return <p className="text-sm text-ink/60">Loading...</p>;

  const set = (itemId: string, p: Partial<Draft>) => setDraft((d) => ({ ...d, [itemId]: { ...d[itemId], ...p } }));
  const editable = o.status === "COLLECTED" || o.status === "RESULTED";
  const liveFlag = (i: Item) => {
    const d = draft[i.id];
    if (!d || d.value.trim() === "") return null;
    return d.flag || flagResult(parseNumeric(d.value), i.refLow, i.refHigh);
  };
  const dirty = o.items.filter((i) => {
    const d = draft[i.id];
    return d && (d.value.trim() !== (i.resultValue ?? "") || d.flag !== "" || d.remarks.trim() !== (i.remarks ?? ""));
  });

  async function act(path: string, body?: unknown, ok = "Saved") {
    setBusy(true);
    setMsg(null);
    const r = await api<{ note?: string }>(`/api/lab/orders/${id}/${path}`, path === "results" ? "PUT" : "POST", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: r.data.note ?? ok });
    setCancelling(false);
    await load();
  }
  async function saveNotes() {
    const r = await api(`/api/lab/orders/${id}`, "PATCH", { clinicalNotes: notes ?? "" });
    setMsg(r.ok ? { ok: true, text: "Notes saved" } : { ok: false, text: r.error });
    if (r.ok) { setNotes(null); await load(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/lab" className="text-sm text-forest hover:underline">Back to laboratory</Link>
          <h1 className="mt-2 font-display text-3xl"><span className="font-data">{o.orderNo}</span> <StatusBadge status={o.status} /></h1>
          <p className="mt-1 text-sm text-ink/60">
            <Link href={`/app/patients/${o.patient.id}`} className="text-forest hover:underline">{o.patient.name}</Link> <span className="font-data text-xs">{o.patient.uhid}</span> · ordered {when(o.createdAt)}{o.orderedBy ? ` by ${o.orderedBy}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {o.status === "ORDERED" && <button disabled={busy} onClick={() => act("collect", undefined, "Sample marked as collected")} className={btnPrimary}>Mark sample collected</button>}
          {o.status !== "CANCELLED" && o.status !== "ORDERED" && <Link href={`/app/lab/${o.id}/report`} className={btnGhost}>Print report</Link>}
          {(o.status === "ORDERED" || o.status === "COLLECTED") && <button onClick={() => setCancelling(true)} className={btnGhost}>Cancel order</button>}
        </div>
      </div>
      <Notice msg={msg} />

      {o.status === "CANCELLED" && <Card><p className="text-sm text-clay">Cancelled{o.cancelReason ? `: ${o.cancelReason}` : ""}</p></Card>}
      {cancelling && (
        <Card className="space-y-3">
          <p className="text-sm">Cancel this order? An unpaid invoice is cancelled with it. If the invoice has payments the cancel is refused.</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason" className={`${input} w-full`} />
          <div className="flex gap-2">
            <button disabled={busy || reason.trim().length < 3} onClick={() => act("cancel", { reason }, "Order cancelled")} className={btnPrimary}>Confirm cancel</button>
            <button onClick={() => setCancelling(false)} className={btnGhost}>Keep order</button>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-ink/50">
            <th className="px-4 py-3">Test</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Flag</th><th className="px-4 py-3">Remarks</th>
          </tr></thead>
          <tbody>
            {o.items.map((i) => {
              const d = draft[i.id] ?? { value: "", flag: "", remarks: "" };
              const f = liveFlag(i);
              return (
                <tr key={i.id} className="border-b border-sand/60 last:border-0 align-top">
                  <td className="px-4 py-2">{i.testName}</td>
                  <td className="px-4 py-2">
                    {editable ? <input value={d.value} onChange={(e) => set(i.id, { value: e.target.value })} aria-label={`Result for ${i.testName}`} maxLength={200} className={`${input} w-32 font-data ${f && f !== "NORMAL" ? "border-clay text-clay" : ""}`} />
                      : <span className="font-data">{i.resultValue ?? "-"}</span>}
                  </td>
                  <td className="px-4 py-2 text-ink/60">{i.unit}</td>
                  <td className="px-4 py-2 font-data text-xs text-ink/60">{i.range || "-"}</td>
                  <td className="px-4 py-2">
                    <FlagBadge flag={f} />
                    {editable && d.value.trim() !== "" && (
                      <select value={d.flag} onChange={(e) => set(i.id, { flag: e.target.value })} aria-label={`Flag for ${i.testName}`} className="ml-2 rounded border border-sand px-1 py-0.5 text-xs">
                        <option value="">Auto</option><option value="NORMAL">Normal</option><option value="LOW">Low</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editable ? <input value={d.remarks} onChange={(e) => set(i.id, { remarks: e.target.value })} aria-label={`Remarks for ${i.testName}`} maxLength={300} className={`${input} w-44`} /> : <span className="text-ink/60">{i.remarks}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={busy || dirty.length === 0}
            onClick={() => act("results", { results: dirty.map((i) => ({ itemId: i.id, value: draft[i.id].value.trim(), flag: draft[i.id].flag || undefined, remarks: draft[i.id].remarks.trim() || undefined })) }, "Results saved")}
            className={btnPrimary}
          >{o.status === "RESULTED" ? "Save correction" : "Save results"}</button>
          <span className="text-xs text-ink/50">{o.status === "RESULTED" ? "Changing a reported value is recorded as a correction in the audit log." : "The order is marked Resulted once every test has a value."}</span>
        </div>
      )}
      {o.status === "ORDERED" && <p className="text-xs text-ink/50">Mark the sample collected to enter results.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-display text-xl">Order details</h2>
          <p className="text-sm text-ink/70">Total <span className="font-data">{inr(o.total)}</span> (incl. GST)</p>
          {o.invoice ? <p className="text-sm">Invoice <Link href={`/app/invoices/${o.invoice.id}`} className="font-data text-forest underline">{o.invoice.number}</Link> <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${statusClass(o.invoice.status)}`}>{o.invoice.status}</span></p> : <p className="text-sm text-ink/50">Not billed</p>}
          {o.collectedAt && <p className="text-sm text-ink/70">Collected {when(o.collectedAt)}</p>}
          {o.resultedAt && <p className="text-sm text-ink/70">Resulted {when(o.resultedAt)}</p>}
          <div className="pt-2">
            <p className="font-data text-[11px] uppercase tracking-widest text-ink/40">Clinical notes</p>
            {notes === null ? (
              <p className="text-sm">{o.clinicalNotes || <span className="text-ink/40">None</span>} {o.status !== "CANCELLED" && <button onClick={() => setNotes(o.clinicalNotes ?? "")} className="ml-2 text-forest hover:underline">Edit</button>}</p>
            ) : (
              <div className="space-y-2">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} aria-label="Clinical notes" className={`${input} w-full`} />
                <div className="flex gap-2"><button onClick={saveNotes} className={btnPrimary}>Save</button><button onClick={() => setNotes(null)} className={btnGhost}>Cancel</button></div>
              </div>
            )}
          </div>
        </Card>
        {o.amendments.length > 0 && (
          <Card className="space-y-2">
            <h2 className="font-display text-xl">Corrections</h2>
            {o.amendments.map((a, n) => (
              <div key={n} className="text-sm">
                <p className="text-xs text-ink/50">{when(a.at)}{a.by ? ` · ${a.by}` : ""}</p>
                {a.changes.map((c, k) => <p key={k}>{c.test}: <span className="font-data line-through">{c.from}</span> to <span className="font-data">{c.to}</span></p>)}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
