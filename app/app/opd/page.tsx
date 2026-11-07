"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";

type Visit = {
  id: string;
  tokenNumber: number;
  status: "WAITING" | "IN_CONSULT" | "COMPLETED" | "CANCELLED";
  type: string;
  chiefComplaint: string | null;
  createdAt: string;
  patient: { id: string; name: string; phone: string; uhid: string | null; gender: string | null; allergies: string | null };
  doctor: { id: string; name: string };
};
type PatientHit = { id: string; name: string; phone: string; uhid: string | null };
type Doctor = { id: string; name: string };

const STATUS_STYLE: Record<Visit["status"], string> = {
  WAITING: "bg-clay-light/60 text-clay",
  IN_CONSULT: "bg-forest-light/30 text-forest",
  COMPLETED: "bg-sand text-ink/60",
  CANCELLED: "bg-sand text-ink/40 line-through",
};
const STATUS_LABEL: Record<Visit["status"], string> = {
  WAITING: "Waiting",
  IN_CONSULT: "In consult",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const waitMins = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

export default function OpdQueuePage() {
  const [date, setDate] = useState(today());
  const [doctorFilter, setDoctorFilter] = useState("");
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [tick, setTick] = useState(0);

  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [picked, setPicked] = useState<PatientHit | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [complaint, setComplaint] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        setDoctors(d.doctors ?? []);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const qs = new URLSearchParams({ date });
    if (doctorFilter) qs.set("doctorId", doctorFilter);
    fetch(`/api/visits?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancel) setVisits(d.visits ?? []);
      });
    return () => {
      cancel = true;
    };
  }, [date, doctorFilter, tick]);

  // Keep the queue live for the front desk.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!q.trim() || picked) return;
    let cancel = false;
    const t = setTimeout(() => {
      fetch(`/api/patients?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancel) setHits((d.patients ?? []).slice(0, 6));
        });
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q, picked]);

  async function createVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || !doctorId) return;
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: picked.id, doctorId, chiefComplaint: complaint || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErr(data.error ?? "Could not create visit");
      return;
    }
    setPicked(null);
    setQ("");
    setHits([]);
    setComplaint("");
    setShowNew(false);
    setTick((n) => n + 1);
  }

  const counts = {
    waiting: visits?.filter((v) => v.status === "WAITING").length ?? 0,
    inConsult: visits?.filter((v) => v.status === "IN_CONSULT").length ?? 0,
    done: visits?.filter((v) => v.status === "COMPLETED").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">OPD Queue</h1>
          <p className="mt-1 text-sm text-ink/60">
            {counts.waiting} waiting · {counts.inConsult} in consult · {counts.done} done
          </p>
        </div>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep"
        >
          + New visit
        </button>
      </div>

      {showNew && (
        <Card>
          <form onSubmit={createVisit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="relative">
                <label className="text-[10px] uppercase tracking-widest text-ink/40">Patient (name, phone or UHID)</label>
                {picked ? (
                  <div className="mt-1 flex items-center justify-between rounded-lg border border-forest bg-white px-3 py-2 text-sm">
                    <span>
                      {picked.name} <span className="text-ink/50">· {picked.uhid ?? picked.phone}</span>
                    </span>
                    <button type="button" onClick={() => setPicked(null)} className="text-xs text-ink/50 hover:text-clay">
                      change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Start typing…"
                      className="mt-1 w-full rounded-lg border border-sand px-3 py-2 text-sm"
                    />
                    {hits.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-sand bg-white shadow-sm">
                        {hits.map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setPicked(h);
                                setHits([]);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-sand/40"
                            >
                              {h.name} <span className="text-ink/50">· {h.uhid ?? "no UHID"} · {h.phone}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <p className="mt-1 text-xs text-ink/50">
                  Not registered? <Link href="/app/patients" className="text-forest underline">Add the patient first</Link>
                </p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-ink/40">Doctor</label>
                <select
                  required
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-sand px-3 py-2 text-sm"
                >
                  <option value="">Select doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-ink/40">Chief complaint</label>
                <input
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="e.g. Knee pain 2 weeks"
                  className="mt-1 w-full rounded-lg border border-sand px-3 py-2 text-sm"
                />
              </div>
            </div>
            {err && <p className="text-sm text-clay">{err}</p>}
            <button
              type="submit"
              disabled={saving || !picked || !doctorId}
              className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-50"
            >
              {saving ? "Issuing token…" : "Issue token"}
            </button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-sand bg-white px-3 py-2 text-sm"
        />
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="rounded-lg border border-sand bg-white px-3 py-2 text-sm"
        >
          <option value="">All doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
              <th className="px-6 py-3">Token</th>
              <th className="px-6 py-3">Patient</th>
              <th className="px-6 py-3">Doctor</th>
              <th className="px-6 py-3">Complaint</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visits === null && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-ink/50">Loading…</td>
              </tr>
            )}
            {visits?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-ink/50">
                  No visits for this day yet. Use “New visit” to issue the first token.
                </td>
              </tr>
            )}
            {visits?.map((v) => (
              <tr key={v.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/20">
                <td className="px-6 py-3 font-display text-2xl">#{v.tokenNumber}</td>
                <td className="px-6 py-3">
                  <div className="font-medium">{v.patient.name}</div>
                  <div className="text-xs text-ink/50">
                    {v.patient.uhid ?? "no UHID"} · {v.patient.phone}
                  </div>
                  {v.patient.allergies && <div className="text-xs text-clay">⚠ Allergy: {v.patient.allergies}</div>}
                </td>
                <td className="px-6 py-3 text-ink/70">{v.doctor.name}</td>
                <td className="px-6 py-3 text-ink/70">{v.chiefComplaint ?? "—"}</td>
                <td className="px-6 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLE[v.status]}`}>{STATUS_LABEL[v.status]}</span>
                  {v.status === "WAITING" && <span className="ml-2 text-xs text-ink/40">{waitMins(v.createdAt)} min</span>}
                </td>
                <td className="px-6 py-3 text-right">
                  <Link href={`/app/opd/${v.id}`} className="rounded-lg border border-sand px-3 py-1.5 text-xs hover:bg-sand/50">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
