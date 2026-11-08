"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, day, Notice, type Msg } from "@/components/ipd/ui";

type Row = { id: string; status: string; diagnosis: string | null; finalizedAt: string | null; updatedAt: string; doctor: { name: string; title: string | null }; admission: { id: string; admissionNo: string; dischargedAt: string | null; patient: { name: string; uhid: string | null } } };
type Missing = { id: string; admissionNo: string; dischargedAt: string | null; diagnosis: string | null; patient: { name: string; uhid: string | null } };

export default function DischargeListPage() {
  const [status, setStatus] = useState<"" | "DRAFT" | "FINAL">("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [missing, setMissing] = useState<Missing[]>([]);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (q.trim()) qs.set("q", q.trim());
      api<{ summaries: Row[]; missing: Missing[] }>(`/api/discharge?${qs}`).then((r) => {
        if (r.ok) { setRows(r.data.summaries); setMissing(r.data.missing); } else setMsg({ ok: false, text: r.error });
      });
    }, 250);
    return () => clearTimeout(t);
  }, [status, q]);

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-3xl">Discharge summaries</h1><p className="mt-1 text-sm text-ink/60">Drafts are created automatically when a patient is discharged. Finalise to lock and print.</p></div>
      <Notice msg={msg} />
      <div className="flex flex-wrap items-center gap-2">
        {([["", "All"], ["DRAFT", "Drafts"], ["FINAL", "Final"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)} className={`rounded-full px-4 py-1.5 text-sm ${status === k ? "bg-forest text-cream" : "border border-sand text-ink/70"}`}>{label}</button>
        ))}
        <input className="ml-2 w-full max-w-xs rounded-lg border border-sand px-3 py-2 text-sm" placeholder="Search name, UHID or admission no" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows && rows.length === 0 && missing.length === 0 ? (
        <Card><p className="text-sm text-ink/60">No discharge summaries found.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3">{r.admission.patient.name}<span className="ml-2 font-data text-xs text-ink/50">{r.admission.admissionNo}</span></td>
                  <td className="px-6 py-3 text-ink/60">{r.diagnosis ?? "No diagnosis yet"}</td>
                  <td className="px-6 py-3 text-xs text-ink/50">Discharged {day(r.admission.dischargedAt)}</td>
                  <td className="px-6 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs ${r.status === "FINAL" ? "bg-forest/10 text-forest" : "bg-clay-light text-clay"}`}>{r.status === "FINAL" ? "Final" : "Draft"}</span></td>
                  <td className="px-6 py-3 text-right"><Link href={`/app/discharge/${r.admission.id}`} className="text-forest hover:underline">{r.status === "FINAL" ? "View" : "Edit"}</Link></td>
                </tr>
              ))}
              {missing.map((m) => (
                <tr key={m.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3">{m.patient.name}<span className="ml-2 font-data text-xs text-ink/50">{m.admissionNo}</span></td>
                  <td className="px-6 py-3 text-ink/60">{m.diagnosis ?? "-"}</td>
                  <td className="px-6 py-3 text-xs text-ink/50">Discharged {day(m.dischargedAt)}</td>
                  <td className="px-6 py-3"><span className="rounded-full bg-sand px-2.5 py-0.5 text-xs text-ink/60">Not started</span></td>
                  <td className="px-6 py-3 text-right"><Link href={`/app/discharge/${m.id}`} className="text-forest hover:underline">Write</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
