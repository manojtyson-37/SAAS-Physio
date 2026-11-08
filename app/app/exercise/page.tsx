"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnGhost, btnPrimary, fmtDate, input, Notice, STATUS_LABEL, StatusBadge, useCanPrescribe } from "@/components/exercise/ui";

type Row = {
  id: string; title: string; status: string; startDate: string; endDate: string | null; doctor: string | null; itemCount: number;
  patient: { id: string; name: string; uhid: string | null };
  summary: { entries: number; avgAdherence: number | null; latestPain: number | null; painChange: number | null };
};

export default function ExercisePlansPage() {
  const canWrite = useCanPrescribe();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (q.trim()) p.set("q", q.trim());
      api<{ plans: Row[] }>(`/api/exercise/plans?${p}`).then((r) => { if (r.ok) { setRows(r.data.plans); setErr(null); } else setErr(r.error); });
    }, 200);
    return () => clearTimeout(t);
  }, [status, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Exercise plans</h1>
          <p className="mt-1 text-sm text-ink/60">Home exercise programmes with pain and adherence tracking.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/exercise/library" className={btnGhost}>Exercise library</Link>
          {canWrite && <Link href="/app/exercise/new" className={btnPrimary}>New plan</Link>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={`w-64 ${input}`} placeholder="Search title, patient or UHID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search plans" />
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Notice msg={err ? { ok: false, text: err } : null} />
      {rows === null ? <p className="text-sm text-ink/50">Loading...</p> : rows.length === 0 ? (
        <Card><p className="text-sm text-ink/60">No exercise plans {status || q ? "match these filters" : "yet"}.{canWrite && !status && !q ? " Create one with New plan." : ""}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs text-ink/50"><th className="px-6 py-3">Plan</th><th>Patient</th><th>Exercises</th><th>Started</th><th>Adherence</th><th>Pain now</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3"><Link href={`/app/exercise/${r.id}`} className="text-forest hover:underline">{r.title}</Link></td>
                  <td>{r.patient.name} <span className="font-data text-xs text-ink/50">{r.patient.uhid}</span></td>
                  <td>{r.itemCount}</td>
                  <td className="text-ink/60">{fmtDate(r.startDate)}</td>
                  <td className="font-data">{r.summary.avgAdherence === null ? "-" : `${r.summary.avgAdherence}%`}</td>
                  <td className="font-data">{r.summary.latestPain === null ? "-" : `${r.summary.latestPain}/10`}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
