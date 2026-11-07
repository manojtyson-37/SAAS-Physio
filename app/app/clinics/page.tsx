"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/Card";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function ClinicsPage() {
  const [tenants, setTenants] = useState<any[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    gstNumber: "",
    phone: "",
    email: "",
    address: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    clinicType: "PHYSIOTHERAPY",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/clinics");
    const data = await res.json();
    setTenants(data.tenants);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setShowForm(false);
      setForm({ name: "", gstNumber: "", phone: "", email: "", address: "", adminName: "", adminEmail: "", adminPassword: "", clinicType: "PHYSIOTHERAPY" });
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Clinics (Tenants)</h1>
          <p className="mt-1 text-sm text-ink/60">Platform-wide clinic management</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep"
        >
          + Onboard Clinic
        </button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <select aria-label="Clinic type" value={form.clinicType} onChange={(e) => setForm({ ...form, clinicType: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm">
              {[["PHYSIOTHERAPY", "Physiotherapy clinic"], ["DENTAL", "Dental clinic"], ["GENERAL", "General clinic"], ["ORTHO", "Orthopaedic clinic"], ["HOSPITAL", "Small hospital"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input required placeholder="Clinic name*" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
            <input placeholder="GST Number" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
            <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="col-span-full rounded-lg border border-sand px-3 py-2 text-sm" />

            <p className="col-span-full mt-2 font-data text-[10px] uppercase tracking-widest text-ink/40">
              Clinic Admin (first user)
            </p>
            <input required placeholder="Admin name*" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
            <input required type="email" placeholder="Admin email*" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />
            <input required type="password" placeholder="Admin password*" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} className="rounded-lg border border-sand px-3 py-2 text-sm" />

            {error && <p className="col-span-full text-sm text-clay">{error}</p>}
            <div className="col-span-full flex gap-3">
              <button disabled={saving} className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60">
                {saving ? "Creating…" : "Create clinic"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-5 py-2 text-sm text-ink/60 hover:bg-sand/60">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tenants?.map((t) => (
          <Card key={t.id}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand">🏢</div>
            <p className="mt-3 font-display text-lg">{t.name}</p>
            {t.clinicTypeLabel && <p className="mt-1 inline-block rounded-full bg-sand px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink/60">{t.clinicTypeLabel}</p>}
            <p className="text-xs text-ink/50">{t.address}</p>
            {t.gstNumber && <p className="text-xs text-ink/50">GSTIN: {t.gstNumber}</p>}
            <div className="mt-4 grid grid-cols-3 text-center text-sm">
              <div>
                <div className="text-xs text-ink/40">Branches</div>
                <div className="font-medium">{t.branchCount}</div>
              </div>
              <div>
                <div className="text-xs text-ink/40">Staff</div>
                <div className="font-medium">{t.staffCount}</div>
              </div>
              <div>
                <div className="text-xs text-ink/40">Patients</div>
                <div className="font-medium">{t.patientCount}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink/40">Created {fmtDate(t.createdAt)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
