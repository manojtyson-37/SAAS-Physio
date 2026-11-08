"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnPrimary, day, Notice, useRole, WARD_LABEL, when, type AdmissionRow, type BoardWard, type Msg } from "@/components/ipd/ui";

type Tab = "board" | "admitted" | "discharged";
const TILE: Record<string, string> = {
  AVAILABLE: "border-forest/40 bg-forest/10 hover:bg-forest/20",
  OCCUPIED: "border-clay/40 bg-clay-light hover:brightness-95",
  INACTIVE: "border-sand bg-sand/40 text-ink/40",
};

export default function IpdPage() {
  const role = useRole();
  const [tab, setTab] = useState<Tab>("board");
  const [wards, setWards] = useState<BoardWard[] | null>(null);
  const [unassigned, setUnassigned] = useState<AdmissionRow[]>([]);
  const [admitted, setAdmitted] = useState<AdmissionRow[] | null>(null);
  const [history, setHistory] = useState<AdmissionRow[] | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    api<{ wards: BoardWard[]; unassigned: AdmissionRow[] }>("/api/ipd/board").then((r) => {
      if (r.ok) { setWards(r.data.wards); setUnassigned(r.data.unassigned); } else setMsg({ ok: false, text: r.error });
    });
    api<{ admissions: AdmissionRow[] }>("/api/ipd/admissions?status=ADMITTED").then((r) => { if (r.ok) setAdmitted(r.data.admissions); });
  }, []);
  useEffect(() => {
    if (tab !== "discharged") return;
    const t = setTimeout(() => {
      api<{ admissions: AdmissionRow[] }>(`/api/ipd/admissions?status=DISCHARGED${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`).then((r) => { if (r.ok) setHistory(r.data.admissions); });
    }, 250);
    return () => clearTimeout(t);
  }, [tab, q]);

  const activeBeds = wards?.flatMap((w) => (w.isActive ? w.beds.filter((b) => b.isActive) : [])) ?? [];
  const occupied = activeBeds.filter((b) => b.status === "OCCUPIED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Admissions</h1>
          <p className="mt-1 text-sm text-ink/60">Bed board, admitted patients and discharge history.{wards && activeBeds.length > 0 && ` ${occupied} of ${activeBeds.length} beds occupied.`}</p>
        </div>
        <div className="flex gap-2">
          {role === "CLINIC_ADMIN" && <Link href="/app/ipd/setup" className="rounded-lg border border-forest px-4 py-2 text-sm text-forest hover:bg-forest/5">Wards and beds</Link>}
          <Link href="/app/ipd/admit" className={btnPrimary}>Admit patient</Link>
        </div>
      </div>
      <Notice msg={msg} />
      <div className="flex gap-1">
        {([["board", "Bed board"], ["admitted", `Admitted${admitted ? ` (${admitted.length})` : ""}`], ["discharged", "Discharged"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-forest text-cream" : "border border-sand text-ink/70"}`}>{label}</button>
        ))}
      </div>

      {tab === "board" && (
        <div className="space-y-5">
          {wards === null && !msg && <p className="text-sm text-ink/50">Loading...</p>}
          {wards && wards.length === 0 && (
            <Card><p className="text-sm text-ink/60">No wards yet. {role === "CLINIC_ADMIN" ? <Link href="/app/ipd/setup" className="text-forest underline">Set up wards and beds</Link> : "Ask your clinic admin to set up wards and beds."}</p></Card>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-ink/60">
            <span className="rounded border border-forest/40 bg-forest/10 px-2 py-0.5">Available</span>
            <span className="rounded border border-clay/40 bg-clay-light px-2 py-0.5">Occupied</span>
            <span className="rounded border border-sand bg-sand/40 px-2 py-0.5">Not in use</span>
          </div>
          {wards?.map((w) => (
            <Card key={w.id} className={w.isActive ? "" : "opacity-60"}>
              <h2 className="font-display text-xl">{w.name} <span className="ml-1 text-xs font-sans text-ink/50">{WARD_LABEL[w.type] ?? w.type}{w.isActive ? "" : " · not in use"}</span></h2>
              {w.beds.length === 0 && <p className="mt-2 text-sm text-ink/50">No beds in this ward.</p>}
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {w.beds.map((b) => (
                  <Link key={b.id} href={b.status === "OCCUPIED" && b.admission ? `/app/ipd/${b.admission.id}` : b.status === "AVAILABLE" ? `/app/ipd/admit?bedId=${b.id}` : "#"}
                    aria-disabled={b.status === "INACTIVE"} className={`block rounded-xl border p-3 text-sm ${TILE[b.status]}`}>
                    <div className="flex items-center justify-between"><span className="font-data font-medium">{b.label}</span><span className="text-[10px] uppercase tracking-wide">{b.status === "AVAILABLE" ? "Free" : b.status === "OCCUPIED" ? "Occupied" : "Off"}</span></div>
                    {b.admission ? (
                      <div className="mt-1 text-xs"><div className="truncate font-medium">{b.admission.patient.name}</div><div className="text-ink/60">{b.admission.doctor.name} · day {b.admission.days}</div></div>
                    ) : <div className="mt-1 text-xs text-ink/50">₹{b.dailyRate.toLocaleString("en-IN")}/day</div>}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
          {unassigned.length > 0 && (
            <Card>
              <h2 className="font-display text-xl">Admitted without a bed</h2>
              <ul className="mt-2 divide-y divide-sand/60 text-sm">
                {unassigned.map((a) => <li key={a.id} className="py-2"><Link href={`/app/ipd/${a.id}`} className="text-forest hover:underline">{a.patient.name}</Link> <span className="text-ink/50">{a.admissionNo} · assign a bed from the admission page</span></li>)}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "admitted" && (admitted && admitted.length === 0 ? (
        <Card><p className="text-sm text-ink/60">No patients are admitted right now.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-sand text-left text-xs text-ink/50"><th className="px-6 py-2">Patient</th><th className="px-6 py-2">Bed</th><th className="px-6 py-2">Doctor</th><th className="px-6 py-2">Admitted</th><th className="px-6 py-2">Day</th><th /></tr></thead>
            <tbody>
              {admitted?.map((a) => (
                <tr key={a.id} className="border-b border-sand/60 last:border-0">
                  <td className="px-6 py-3">{a.patient.name}<span className="ml-2 font-data text-xs text-ink/50">{a.admissionNo}</span></td>
                  <td className="px-6 py-3 text-ink/70">{a.bed ? `${a.bed.wardName} / ${a.bed.label}` : "No bed"}</td>
                  <td className="px-6 py-3 text-ink/60">{a.doctor.name}</td>
                  <td className="px-6 py-3 text-xs text-ink/50">{when(a.admittedAt)}</td>
                  <td className="px-6 py-3 font-data">{a.days}</td>
                  <td className="px-6 py-3 text-right"><Link href={`/app/ipd/${a.id}`} className="text-forest hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {tab === "discharged" && (
        <div className="space-y-3">
          <input className="w-full max-w-sm rounded-lg border border-sand px-3 py-2 text-sm" placeholder="Search name, UHID or admission no" value={q} onChange={(e) => setQ(e.target.value)} />
          {history && history.length === 0 ? (
            <Card><p className="text-sm text-ink/60">No discharged patients found.</p></Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <tbody>
                  {history?.map((a) => (
                    <tr key={a.id} className="border-b border-sand/60 last:border-0">
                      <td className="px-6 py-3">{a.patient.name}<span className="ml-2 font-data text-xs text-ink/50">{a.admissionNo}</span></td>
                      <td className="px-6 py-3 text-ink/60">{a.diagnosis ?? "-"}</td>
                      <td className="px-6 py-3 text-xs text-ink/50">{day(a.admittedAt)} to {day(a.dischargedAt)} · {a.days} day{a.days === 1 ? "" : "s"}</td>
                      <td className="px-6 py-3 text-right"><Link href={`/app/ipd/${a.id}`} className="text-forest hover:underline">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
