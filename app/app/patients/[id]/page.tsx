"use client";

import { useClinic } from "@/components/ClinicContext";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { PatientDentalPanel } from "@/components/dental/PatientDentalPanel";
import { PatientExercisePanel } from "@/components/exercise/PatientExercisePanel";
import PatientLabPanel from "@/components/lab/PatientLabPanel";
import PatientImagingPanel from "@/components/radiology/PatientImagingPanel";
import PatientAdmissionsPanel from "@/components/ipd/PatientAdmissionsPanel";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type Tab = "overview" | "packages" | "notes" | "invoices" | "appointments" | "dental" | "exercise" | "lab" | "imaging" | "admissions";

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [patient, setPatient] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const clinic = useClinic();
  const [pkgForm, setPkgForm] = useState<{ name: string | null; totalSessions: string; price: string }>({ name: null, totalSessions: "10", price: "8000" });
  const [noteForm, setNoteForm] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/patients/${id}`);
    const data = await res.json();
    setPatient(data.patient);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!patient) return <p className="text-sm text-ink/50">Loading…</p>;

  async function addPackage(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/patients/${id}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pkgForm, name: pkgForm.name ?? clinic.terms.package }),
    });
    setPkgForm({ name: null, totalSessions: "10", price: "" });
    load();
  }

  async function packageAction(pkgId: string, action: string) {
    await fetch(`/api/patients/${id}/packages/${pkgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteForm.trim()) return;
    await fetch(`/api/patients/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteForm }),
    });
    setNoteForm("");
    load();
  }

  const has = (m: string) => clinic.modules.includes(m);
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    ...(has("packages") ? [{ key: "packages" as Tab, label: `${clinic.terms.packages} (${patient.packages.length})` }] : []),
    { key: "notes", label: `Clinical Notes (${patient.clinicalNotes.length})` },
    ...(has("billing") ? [{ key: "invoices" as Tab, label: `Invoices (${patient.invoices.length})` }] : []),
    ...(has("appointments") ? [{ key: "appointments" as Tab, label: `Appointments (${patient.appointments.length})` }] : []),
    ...(has("dental_chart") ? [{ key: "dental" as Tab, label: "Dental" }] : []),
    ...(has("exercise_plans") ? [{ key: "exercise" as Tab, label: "Exercise plans" }] : []),
    ...(has("lab") ? [{ key: "lab" as Tab, label: "Lab" }] : []),
    ...(has("radiology") ? [{ key: "imaging" as Tab, label: "Imaging" }] : []),
    ...(has("ipd") ? [{ key: "admissions" as Tab, label: "Admissions" }] : []),
  ];

  return (
    <div className="space-y-6">
      <Link href="/app/patients" className="text-sm text-ink/50 hover:text-ink">
        ← All patients
      </Link>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-clay-light font-data text-lg font-semibold text-clay">
              {patient.name
                .split(" ")
                .map((p: string) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="font-display text-xl">{patient.name}</p>
              <p className="text-sm text-ink/50">
                {patient.phone} {patient.gender ? `· ${patient.gender}` : ""} · Joined{" "}
                {fmtDate(patient.createdAt)}
              </p>
              <div className="mt-2 flex gap-2">
                {patient.leadSource && (
                  <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs">
                    {patient.leadSource}
                  </span>
                )}
                {patient.reason && (
                  <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs">{patient.reason}</span>
                )}
                {patient.referralDoctor && (
                  <span className="rounded-full bg-clay-light px-2.5 py-0.5 text-xs text-clay">
                    Ref: {patient.referralDoctor}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">Billed</p>
              <p className="font-display text-lg">{inr(patient.billed)}</p>
            </div>
            <div>
              <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">Paid</p>
              <p className="font-display text-lg text-forest">{inr(patient.paid)}</p>
            </div>
            <div>
              <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">
                Outstanding
              </p>
              <p className="font-display text-lg text-clay">{inr(patient.outstanding)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex gap-6 border-b border-sand text-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 pb-3 ${
              tab === t.key ? "border-forest text-forest" : "border-transparent text-ink/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">
              Patient information
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Full name", patient.name],
                ["Reason for consultation", patient.reason ?? "—"],
                ["Lead source", patient.leadSource ?? "—"],
                ["Referral doctor", patient.referralDoctor ?? "—"],
                ["Address", patient.address ?? "—"],
                ["Notes", patient.notes ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-sand/60 pb-2">
                  <dt className="text-ink/50">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">
              Recent activity
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {patient.appointments.slice(0, 5).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between border-b border-sand/60 pb-2">
                  <div>
                    <div>Session with {a.doctor.name}</div>
                    <div className="text-xs text-ink/50">
                      {new Date(a.datetime).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <span className="rounded-full bg-sand px-2 py-0.5 text-xs">
                    {a.status.toLowerCase()}
                  </span>
                </li>
              ))}
              {patient.appointments.length === 0 && <p className="text-ink/40">No activity yet.</p>}
            </ul>
          </Card>
        </div>
      )}

      {tab === "packages" && (
        <div className="space-y-4">
          {patient.packages.map((pkg: any) => (
            <Card key={pkg.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display">{pkg.name}</p>
                    <span className="rounded-full bg-sand px-2 py-0.5 text-xs">
                      {pkg.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink/50">
                    {pkg.usedSessions}/{pkg.totalSessions} sessions used ·{" "}
                    {fmtDate(pkg.startDate)}
                    {pkg.endDate ? ` – ${fmtDate(pkg.endDate)}` : ""} · Total {inr(pkg.price)}
                  </p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => packageAction(pkg.id, pkg.status === "FROZEN" ? "unfreeze" : "freeze")} className="text-ink/60 hover:text-ink">
                    {pkg.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                  </button>
                  <button onClick={() => packageAction(pkg.id, "extend")} className="text-ink/60 hover:text-ink">
                    Extend
                  </button>
                  <button onClick={() => packageAction(pkg.id, "refund")} className="text-clay hover:text-clay/80">
                    Refund
                  </button>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
                <div
                  className="h-full bg-forest"
                  style={{ width: `${Math.min(100, (pkg.usedSessions / pkg.totalSessions) * 100)}%` }}
                />
              </div>
            </Card>
          ))}
          <Card>
            <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">New {clinic.terms.package.toLowerCase()}</p>
            <form onSubmit={addPackage} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                required
                placeholder={`${clinic.terms.package} name`}
                value={pkgForm.name ?? clinic.terms.package}
                onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                className="rounded-lg border border-sand px-3 py-2 text-sm"
              />
              <input
                required
                type="number"
                placeholder="Sessions"
                value={pkgForm.totalSessions}
                onChange={(e) => setPkgForm({ ...pkgForm, totalSessions: e.target.value })}
                className="rounded-lg border border-sand px-3 py-2 text-sm"
              />
              <input
                required
                type="number"
                placeholder="Price"
                value={pkgForm.price}
                onChange={(e) => setPkgForm({ ...pkgForm, price: e.target.value })}
                className="rounded-lg border border-sand px-3 py-2 text-sm"
              />
              <button className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
                Add
              </button>
            </form>
          </Card>
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          {patient.clinicalNotes.map((n: any) => (
            <Card key={n.id}>
              <p className="text-xs text-ink/50">
                {fmtDate(n.date)} · {n.author.name}
              </p>
              <p className="mt-2 text-sm">{n.note}</p>
            </Card>
          ))}
          {patient.clinicalNotes.length === 0 && (
            <p className="text-sm text-ink/40">No clinical notes yet.</p>
          )}
          <Card>
            <form onSubmit={addNote} className="flex gap-3">
              <input
                placeholder="Add a clinical note…"
                value={noteForm}
                onChange={(e) => setNoteForm(e.target.value)}
                className="flex-1 rounded-lg border border-sand px-3 py-2 text-sm"
              />
              <button className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
                Save
              </button>
            </form>
          </Card>
        </div>
      )}

      {tab === "invoices" && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Paid</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {patient.invoices.map((inv: any) => (
                <tr key={inv.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/20">
                  <td className="px-6 py-3">
                    <Link href={`/app/invoices/${inv.id}`} className="font-data hover:text-forest">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-ink/70">{fmtDate(inv.date)}</td>
                  <td className="px-6 py-3 font-data">{inr(inv.total)}</td>
                  <td className="px-6 py-3 font-data">{inr(inv.paidAmount)}</td>
                  <td className="px-6 py-3">
                    <span className="rounded-full bg-sand px-2 py-0.5 text-xs">
                      {inv.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "appointments" && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Doctor</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {patient.appointments.map((a: any) => (
                <tr key={a.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/20">
                  <td className="px-6 py-3 text-ink/70">
                    {new Date(a.datetime).toLocaleString("en-IN")}
                  </td>
                  <td className="px-6 py-3">{a.doctor.name}</td>
                  <td className="px-6 py-3">
                    <span className="rounded-full bg-sand px-2 py-0.5 text-xs">
                      {a.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "dental" && has("dental_chart") && <PatientDentalPanel patientId={patient.id} />}
      {tab === "exercise" && has("exercise_plans") && <PatientExercisePanel patientId={patient.id} />}
      {tab === "lab" && has("lab") && <PatientLabPanel patientId={patient.id} />}
      {tab === "imaging" && has("radiology") && <PatientImagingPanel patientId={patient.id} />}
      {tab === "admissions" && has("ipd") && <PatientAdmissionsPanel patientId={patient.id} />}
    </div>
  );
}
