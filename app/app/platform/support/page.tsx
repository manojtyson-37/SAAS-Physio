"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, input } from "@/components/pharmacy/ui";

export type Ticket = { id: string; number: number; subject: string; category: string; urgent: boolean; status: string; needsUs: boolean; waitingHours: number; createdAt: string; clinic: { id: string; name: string }; messages: number; mine: boolean };

const FILTERS = [
  { key: "ACTIVE", label: "Needs us" },
  { key: "OPEN", label: "All open" },
  { key: "WAITING_CLINIC", label: "Waiting on clinic" },
  { key: "RESOLVED", label: "Resolved" },
];
export const statusLabel = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function SupportInboxPage() {
  const [status, setStatus] = useState("ACTIVE");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<Ticket[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let live = true;
    api<{ tickets: Ticket[] }>(`/api/platform/support?status=${status}&q=${encodeURIComponent(term)}`).then((r) => {
      if (!live) return;
      if (r.ok) { setRows(r.data.tickets); setErr(null); } else setErr(r.error);
    });
    return () => { live = false; };
  }, [status, term]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Support queries</h1>
        <p className="mt-1 text-sm text-ink/60">Questions raised by clinics</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatus(f.key)} className={`rounded-full border px-4 py-1.5 text-sm ${status === f.key ? "border-forest bg-forest text-cream" : "border-ink/15 hover:border-ink/30"}`}>{f.label}</button>
        ))}
        <input className={`${input} ml-auto w-full sm:w-64`} placeholder="Search subject or clinic" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <p className="text-sm text-clay">{err}</p>}
      <Card className="p-0">
        {!rows && !err ? <p className="p-6 text-sm text-ink/50">Loading...</p> : rows && rows.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">No queries here.</p>
        ) : rows && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/50">
                  <th className="px-4 py-2 font-normal">#</th>
                  <th className="px-4 py-2 font-normal">Clinic</th>
                  <th className="px-4 py-2 font-normal">Subject</th>
                  <th className="px-4 py-2 font-normal">Category</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 font-normal">Waiting</th>
                  <th className="px-4 py-2 font-normal">Msgs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-sand/60 hover:bg-sand/30">
                    <td className="px-4 py-2 font-data text-ink/50"><Link href={`/app/platform/support/${t.id}`}>#{t.number}</Link></td>
                    <td className="px-4 py-2">{t.clinic.name}</td>
                    <td className="px-4 py-2">
                      <Link href={`/app/platform/support/${t.id}`} className="font-medium text-forest hover:underline">{t.subject}</Link>
                      {t.urgent && <span className="ml-2 rounded-full bg-clay-light px-2 py-0.5 text-xs text-clay">Urgent</span>}
                      {t.mine && <span className="ml-2 text-xs text-ink/40">Mine</span>}
                    </td>
                    <td className="px-4 py-2 text-ink/60">{statusLabel(t.category)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{statusLabel(t.status)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-ink/60">{t.needsUs ? `${t.waitingHours} h` : "-"}</td>
                    <td className="px-4 py-2 text-ink/60">{t.messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
