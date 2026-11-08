"use client";

import { useEffect, useState } from "react";
import { api, input } from "@/components/pharmacy/ui";

export { api, btnGhost, btnPrimary, input, inr, Notice, type Msg } from "@/components/pharmacy/ui";

export const WARD_LABEL: Record<string, string> = {
  GENERAL: "General", SEMI_PRIVATE: "Semi-private", PRIVATE: "Private", ICU: "ICU", NICU: "NICU", HDU: "HDU", OTHER: "Other",
};

export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "-";
export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "-";

/** Value for <input type="datetime-local"> in the browser's own time zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

export const newRef = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "");

/** Role of the signed-in user (UI hints only; the API enforces access). */
export function useRole(): string | null {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setRole(d.user?.role ?? null)).catch(() => {});
  }, []);
  return role;
}

export type PatientOpt = { id: string; name: string; uhid: string | null; phone: string };

export function PatientPicker({ value, onChange }: { value: PatientOpt | null; onChange: (p: PatientOpt | null) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PatientOpt[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      api<{ patients: PatientOpt[] }>(`/api/patients?limit=6&q=${encodeURIComponent(q.trim())}`).then((r) => { if (r.ok) setFound(r.data.patients.slice(0, 6)); });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-sand bg-white/60 px-3 py-2 text-sm">
        <span>{value.name}<span className="ml-2 font-data text-xs text-ink/50">{value.uhid} {value.phone}</span></span>
        <button type="button" onClick={() => { onChange(null); setQ(""); setFound([]); }} className="text-xs text-forest underline">Change</button>
      </div>
    );
  }
  return (
    <div>
      <input className={`${input} w-full`} placeholder="Search patient by name, phone or UHID" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 && (
        <ul className="mt-1 divide-y divide-sand/60 rounded-lg border border-sand bg-white text-sm">
          {found.length === 0 && <li className="px-3 py-2 text-ink/50">No patient found</li>}
          {found.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onChange(p)} className="w-full px-3 py-2 text-left hover:bg-sand/40">
                {p.name}<span className="ml-2 font-data text-xs text-ink/50">{p.uhid} {p.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type BoardBed = { id: string; label: string; dailyRate: number; isActive: boolean; status: "AVAILABLE" | "OCCUPIED" | "INACTIVE"; admission: AdmissionRow | null };
export type BoardWard = { id: string; name: string; type: string; isActive: boolean; beds: BoardBed[] };
export type AdmissionRow = {
  id: string; admissionNo: string; status: string; admittedAt: string; dischargedAt: string | null; expectedDischargeAt: string | null;
  reason: string | null; diagnosis: string | null; notes: string | null; invoiceId: string | null; days: number;
  patient: { id: string; name: string; uhid: string | null; phone: string };
  doctor: { id: string; name: string; title: string | null };
  bed: { id: string; label: string; wardId: string; wardName: string; wardType: string } | null;
};

/** Free-bed dropdown grouped by ward. */
export function BedSelect({ wards, value, onChange, exceptBedId, allowNone }: { wards: BoardWard[]; value: string; onChange: (v: string) => void; exceptBedId?: string | null; allowNone?: boolean }) {
  return (
    <select className={`${input} w-full`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allowNone ? "No bed yet" : "Choose a free bed"}</option>
      {wards.filter((w) => w.isActive).map((w) => {
        const free = w.beds.filter((b) => b.status === "AVAILABLE" && b.id !== exceptBedId);
        if (free.length === 0) return null;
        return (
          <optgroup key={w.id} label={`${w.name} (${WARD_LABEL[w.type] ?? w.type})`}>
            {free.map((b) => <option key={b.id} value={b.id}>{b.label} - ₹{b.dailyRate.toLocaleString("en-IN")}/day</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}
