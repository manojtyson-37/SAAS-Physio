"use client";

import { useEffect, useState } from "react";
import { api, input } from "@/components/pharmacy/ui";

/** Fresh idempotency key for one create attempt (kept across retries of the same form submit). */
export const newRef = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "");

export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";

export const ageOf = (dob: string | null) => {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00Z`), n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--;
  return a >= 0 ? a : null;
};

const STATUS: Record<string, string> = {
  ORDERED: "bg-sand text-ink/70", SCHEDULED: "bg-sand text-forest", COLLECTED: "bg-sand text-forest", PERFORMED: "bg-sand text-forest",
  RESULTED: "bg-forest/10 text-forest", REPORTED: "bg-forest/10 text-forest", CANCELLED: "bg-ink/10 text-ink/50 line-through",
};
const STATUS_TEXT: Record<string, string> = {
  ORDERED: "Ordered", SCHEDULED: "Scheduled", COLLECTED: "Sample collected", PERFORMED: "Performed", RESULTED: "Resulted", REPORTED: "Reported", CANCELLED: "Cancelled",
};
export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS[status] ?? "bg-sand text-ink/60"}`}>{STATUS_TEXT[status] ?? status}</span>
);

const FLAG: Record<string, string> = { LOW: "bg-clay-light text-clay", HIGH: "bg-clay-light text-clay", CRITICAL: "bg-clay text-cream", NORMAL: "bg-forest/10 text-forest" };
const FLAG_TEXT: Record<string, string> = { LOW: "L", HIGH: "H", CRITICAL: "Critical", NORMAL: "Normal" };
export const FlagBadge = ({ flag }: { flag: string | null }) =>
  flag ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG[flag] ?? ""}`}>{FLAG_TEXT[flag] ?? flag}</span> : null;

export type PickPatient = { id: string; name: string; uhid: string | null; phone: string };

/** Search-as-you-type patient chooser. Shows the chosen patient with a Change button. */
export function PatientPicker({ value, onChange }: { value: PickPatient | null; onChange: (p: PickPatient | null) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PickPatient[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      api<{ patients: PickPatient[] }>(`/api/patients?q=${encodeURIComponent(q.trim())}`).then((r) => { if (r.ok) setFound(r.data.patients.slice(0, 6)); });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-sand bg-white px-4 py-2 text-sm">
        <span>{value.name}<span className="ml-2 font-data text-xs text-ink/50">{value.uhid} {value.phone}</span></span>
        <button type="button" onClick={() => { onChange(null); setQ(""); setFound([]); }} className="text-forest hover:underline">Change</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient by name, phone or UHID" aria-label="Search patient" className={`${input} w-full`} />
      {q.trim().length >= 2 && found.length === 0 && <p className="text-xs text-ink/50">No patient found.</p>}
      {q.trim().length >= 2 && found.length > 0 && (
        <ul className="divide-y divide-sand/60 rounded-lg border border-sand bg-white text-sm">
          {found.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onChange(p)} className="flex w-full justify-between px-4 py-2 text-left hover:bg-sand/40">
                <span>{p.name}</span><span className="font-data text-xs text-ink/50">{p.uhid} {p.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
