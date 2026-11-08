"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { statusClass } from "@/components/billing/status";
import { api, btnPrimary, inr, Notice, type Msg } from "@/components/pharmacy/ui";

type QueueRow = { id: string; at: string; patient: { id: string; name: string; uhid: string | null }; doctor: string; items: number };
type Hist = { id: string; status: string; total: number; at: string; items: number; fromPrescription: boolean; patient: { id: string; name: string; uhid: string | null }; invoice: { id: string; number: string; status: string } | null; by: string | null };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default function PharmacyPage() {
  const [queue, setQueue] = useState<QueueRow[] | null>(null);
  const [hist, setHist] = useState<Hist[] | null>(null);
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    api<{ queue: QueueRow[] }>("/api/pharmacy/queue").then((r) => (r.ok ? setQueue(r.data.queue) : setMsg({ ok: false, text: r.error })));
    api<{ dispensations: Hist[] }>("/api/pharmacy/dispensations").then((r) => { if (r.ok) setHist(r.data.dispensations); });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Pharmacy</h1>
          <p className="mt-1 text-sm text-ink/60">Dispense doctors&apos; prescriptions or sell over the counter. Oldest-expiry batch is used first.</p>
        </div>
        <Link href="/app/pharmacy/dispense" className={btnPrimary}>Counter sale</Link>
      </div>
      <Notice msg={msg} />
      <div className="flex gap-1">
        {([["queue", `To dispense${queue ? ` (${queue.length})` : ""}`], ["history", "History"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-forest text-cream" : "border border-sand text-ink/70"}`}>{label}</button>
        ))}
      </div>

      {tab === "queue" && (queue && queue.length === 0 ? (
        <Card><p className="text-sm text-ink/60">No prescriptions waiting. New ones appear here as soon as a doctor saves them.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <tbody>
              {queue?.map((r) => (
                <tr key={r.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3">{r.patient.name}<span className="ml-2 font-data text-xs text-ink/50">{r.patient.uhid}</span></td>
                  <td className="px-6 py-3 text-ink/60">{r.doctor} · {r.items} medicine{r.items === 1 ? "" : "s"}</td>
                  <td className="px-6 py-3 text-xs text-ink/50">{when(r.at)}</td>
                  <td className="px-6 py-3 text-right"><Link href={`/app/pharmacy/dispense?rx=${r.id}`} className="text-forest hover:underline">Dispense</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {tab === "history" && (hist && hist.length === 0 ? (
        <Card><p className="text-sm text-ink/60">Nothing dispensed yet.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <tbody>
              {hist?.map((d) => (
                <tr key={d.id} className={`border-b border-sand/60 last:border-0 ${d.status === "VOIDED" ? "opacity-60" : ""}`}>
                  <td className="px-6 py-3 text-xs text-ink/50">{when(d.at)}</td>
                  <td className="px-6 py-3">{d.patient.name}<span className="ml-2 font-data text-xs text-ink/50">{d.patient.uhid}</span></td>
                  <td className="px-6 py-3 text-ink/60">{d.items} line{d.items === 1 ? "" : "s"} · {d.fromPrescription ? "Prescription" : "Counter"}</td>
                  <td className="px-6 py-3 font-data">{inr(d.total)}</td>
                  <td className="px-6 py-3">{d.status === "VOIDED" ? <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusClass("CANCELLED")}`}>Voided</span> : d.invoice ? <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusClass(d.invoice.status)}`}>{d.invoice.status}</span> : null}</td>
                  <td className="px-6 py-3 text-right"><Link href={`/app/pharmacy/${d.id}`} className="text-forest hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
