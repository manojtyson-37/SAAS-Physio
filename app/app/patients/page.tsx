"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useHasModule } from "@/components/ClinicContext";

type Patient = {
  id: string;
  name: string;
  phone: string;
  uhid: string | null;
  createdAt: string;
  reason: string | null;
  leadSource: string | null;
  billed: number;
  outstanding: number;
};

const LEAD_LABELS: Record<string, string> = {
  DIRECT: "Direct",
  REFERRAL: "Referral",
  GOOGLE: "Google",
  FACEBOOK: "Facebook",
  WALK_IN: "Walk-in",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function PatientsPage() {
  const billingOn = useHasModule("billing");
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const blank = { name: "", phone: "", gender: "", dob: "", bloodGroup: "", allergies: "", abhaId: "", reason: "", leadSource: "WALK_IN" };
  const [form, setForm] = useState(blank);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query: string) => {
    const res = await fetch(`/api/patients${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    const data = await res.json();
    setPatients(data.patients);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    try {
      // Empty optional fields are omitted so the API doesn't see "" for dates/enums.
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormErr(data.error ?? "Could not save patient");
        return;
      }
      setForm(blank);
      setShowForm(false);
      load(q);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Patients</h1>
          <p className="mt-1 text-sm text-ink/60">{patients?.length ?? 0} records</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep"
        >
          + Add Patient
        </button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input
              required
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            />
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            >
              <option value="">Gender</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
            <input
              type="date"
              title="Date of birth"
              value={form.dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            />
            <select
              value={form.bloodGroup}
              onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            >
              <option value="">Blood group</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <input
              placeholder="ABHA number (14 digits)"
              value={form.abhaId}
              onChange={(e) => setForm({ ...form, abhaId: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            />
            <input
              placeholder="Known allergies"
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              placeholder="Reason for consultation"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            />
            <select
              value={form.leadSource}
              onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
              className="rounded-lg border border-sand px-3 py-2 text-sm"
            >
              {Object.entries(LEAD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {formErr && <p className="col-span-full text-sm text-clay">{formErr}</p>}
            <div className="col-span-full flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save patient"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-5 py-2 text-sm text-ink/60 hover:bg-sand/60"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <input
        placeholder="Search by name, phone or UHID…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          load(e.target.value);
        }}
        className="w-full max-w-md rounded-lg border border-sand bg-white px-4 py-2.5 text-sm outline-none focus:border-forest"
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
              <th className="px-6 py-3">Patient</th>
              <th className="px-6 py-3">Joined</th>
              <th className="px-6 py-3">Reason</th>
              <th className="px-6 py-3">Lead</th>
              {billingOn && <th className="px-6 py-3">Billed</th>}
              {billingOn && <th className="px-6 py-3">Outstanding</th>}
            </tr>
          </thead>
          <tbody>
            {patients?.map((p) => (
              <tr key={p.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/20">
                <td className="px-6 py-3">
                  <Link href={`/app/patients/${p.id}`} className="font-medium hover:text-forest">
                    {p.name}
                  </Link>
                  <div className="text-xs text-ink/50">{p.uhid ? `${p.uhid} · ` : ""}{p.phone}</div>
                </td>
                <td className="px-6 py-3 text-ink/70">
                  {new Date(p.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-6 py-3 text-ink/70">{p.reason ?? "—"}</td>
                <td className="px-6 py-3 text-ink/70">
                  {p.leadSource ? LEAD_LABELS[p.leadSource] : "—"}
                </td>
                {billingOn && <td className="px-6 py-3 font-data">{inr(p.billed)}</td>}
                {billingOn && (
                  <td className="px-6 py-3 font-data">
                    {p.outstanding > 0 ? (
                      <span className="text-clay">{inr(p.outstanding)}</span>
                    ) : (
                      <span className="text-forest">Cleared</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
