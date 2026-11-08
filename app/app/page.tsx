"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Card, StatCard } from "@/components/Card";
import { useClinic } from "@/components/ClinicContext";

type DashboardData = {
  modules: string[];
  patientsCount: number;
  newPatientsToday: number;
  doctorsCount: number;
  staffCount: number;
  billing?: {
    collectedToday: number;
    collectedByMethod: { method: string; amount: number }[];
    billedToday: number;
    invoicesToday: number;
    outstanding: number;
    openInvoices: number;
    trend: { date: string; revenue: number }[];
  };
  opd?: {
    total: number;
    waiting: number;
    inConsult: number;
    completed: number;
    avgWaitMin: number | null;
    avgConsultMin: number | null;
    queue: { token: number; patient: string; doctor: string; waitingMin: number }[];
  };
  appointments?: { today: number; upcoming: number };
  packages?: { active: number; runningLow: number };
  stock?: { items: number; lowStock: number; outOfStock: number; expiringBatches: number; expiredBatches: number };
  pharmacy?: { pendingRx: number; dispensedToday: number; soldToday: number };
  lab?: { pending: number; resultedToday: number };
  radiology?: { pending: number; reportedToday: number };
  ipd?: { totalBeds: number; admitted: number; icuOccupied: number; dischargedToday: number; draftSummaries: number | null };
  dental?: { activePlans: number };
  exercise?: { activePlans: number };
  leadCounts?: Record<string, number>;
  doctors: { id: string; name: string; specialty: string | null; patients: number; revenue: number | null }[];
  revenueByBranch?: { name: string; revenue: number }[];
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const LEAD_LABELS: Record<string, string> = {
  DIRECT: "Direct",
  REFERRAL: "Referral",
  GOOGLE: "Google",
  FACEBOOK: "Facebook",
  WALK_IN: "Walk-in",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
};

const eyebrow = "font-data text-[10px] uppercase tracking-widest text-ink/40";
const axis = { fontSize: 11, fill: "var(--sage)" };

export default function DashboardPage() {
  const clinic = useClinic();
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-sm text-clay">Could not load the dashboard. Refresh to try again.</p>;
  if (!data) return <p className="text-sm text-ink/50">Loading dashboard…</p>;

  const { billing, opd, appointments, packages } = data;
  const hasRevenue = !!billing;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-ink/60">{clinic.clinicTypeLabel} · today at a glance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {billing && (
          <StatCard
            label="Collected today"
            value={inr(billing.collectedToday)}
            sub={billing.collectedByMethod.map((m) => `${m.method} ${inr(m.amount)}`).join(" · ") || "No payments yet"}
          />
        )}
        {opd && (
          <StatCard
            label="OPD today"
            value={String(opd.total)}
            sub={`${opd.waiting} waiting · ${opd.inConsult} in consult · ${opd.completed} done`}
          />
        )}
        {appointments && (
          <StatCard label="Appointments today" value={String(appointments.today)} sub={`${appointments.upcoming} upcoming`} />
        )}
        <StatCard
          label="Patients"
          value={data.patientsCount.toLocaleString("en-IN")}
          sub={`${data.newPatientsToday} registered today`}
        />
        {billing && (
          <StatCard label="Outstanding" value={inr(billing.outstanding)} sub={`${billing.openInvoices} open invoices`} />
        )}
        {data.pharmacy && (
          <StatCard
            label="Pharmacy"
            value={String(data.pharmacy.pendingRx)}
            sub={`prescriptions to dispense · ${data.pharmacy.dispensedToday} sold today (${inr(data.pharmacy.soldToday)})`}
          />
        )}
        {data.stock && (
          <StatCard
            label="Stock alerts"
            value={String(data.stock.lowStock + data.stock.outOfStock + data.stock.expiringBatches + data.stock.expiredBatches)}
            sub={`${data.stock.lowStock} low · ${data.stock.outOfStock} out · ${data.stock.expiringBatches} expiring · ${data.stock.expiredBatches} expired`}
          />
        )}
        {data.ipd && (
          <StatCard
            label="Beds occupied"
            value={`${data.ipd.admitted}/${data.ipd.totalBeds}`}
            sub={`${data.ipd.icuOccupied} in ICU · ${data.ipd.dischargedToday} discharged today${data.ipd.draftSummaries ? ` · ${data.ipd.draftSummaries} summaries to finalise` : ""}`}
          />
        )}
        {data.lab && <StatCard label="Lab orders pending" value={String(data.lab.pending)} sub={`${data.lab.resultedToday} resulted today`} />}
        {data.radiology && <StatCard label="Imaging pending" value={String(data.radiology.pending)} sub={`${data.radiology.reportedToday} reported today`} />}
        {data.dental && <StatCard label="Open treatment plans" value={String(data.dental.activePlans)} sub="proposed, accepted or in progress" />}
        {data.exercise && <StatCard label="Active exercise plans" value={String(data.exercise.activePlans)} sub="patients on a home programme" />}
        {packages && (
          <StatCard
            label={`Active ${clinic.terms.packages.toLowerCase()}`}
            value={String(packages.active)}
            sub={packages.runningLow ? `${packages.runningLow} running low` : "None running low"}
          />
        )}
      </div>

      {opd && (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={eyebrow}>OPD</p>
              <p className="mt-1 font-display text-lg">Waiting now</p>
              <p className="mt-1 text-xs text-ink/50">
                Avg wait {opd.avgWaitMin ?? "—"} min · avg consult {opd.avgConsultMin ?? "—"} min
              </p>
            </div>
            <Link href="/app/opd" className="rounded-full border border-ink/15 px-4 py-1.5 text-sm hover:border-ink/30">
              Open queue
            </Link>
          </div>
          {opd.queue.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">Nobody is waiting.</p>
          ) : (
            <ul className="mt-4 divide-y divide-sand/60">
              {opd.queue.map((q) => (
                <li key={q.token} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="mr-3 font-data text-ink/50">#{q.token}</span>
                    {q.patient}
                  </span>
                  <span className="text-xs text-ink/50">
                    {q.doctor} · waiting {q.waitingMin} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {(billing || data.leadCounts) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {billing && (
            <Card>
              <p className={eyebrow}>Last 30 days</p>
              <p className="mt-1 font-display text-lg">Collections trend</p>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={billing.trend}>
                    <CartesianGrid stroke="var(--sand)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={axis} axisLine={false} tickLine={false} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => inr(Number(v))} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--forest)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {data.leadCounts && (
            <Card>
              <p className={eyebrow}>Lead attribution</p>
              <p className="mt-1 font-display text-lg">Where patients come from</p>
              <ul className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
                {Object.entries(data.leadCounts).map(([key, count]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-forest" />
                    {LEAD_LABELS[key] ?? key}
                    <span className="ml-auto font-data text-ink/60">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <p className={eyebrow}>Doctors</p>
          <p className="mt-1 font-display text-lg">{hasRevenue ? "Performance leaderboard" : "Patients seen"}</p>
          {data.doctors.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">No doctors yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {data.doctors.map((d, i) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-data text-ink/40">{i + 1}</span>
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-ink/50">
                        {d.specialty ?? "—"} · {d.patients} patients
                      </div>
                    </div>
                  </div>
                  {d.revenue !== null && <span className="font-data">{inr(d.revenue)}</span>}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {data.revenueByBranch && (
          <Card>
            <p className={eyebrow}>Branches</p>
            <p className="mt-1 font-display text-lg">Revenue by branch</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByBranch}>
                  <CartesianGrid stroke="var(--sand)" vertical={false} />
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => inr(Number(v))} />
                  <Bar dataKey="revenue" fill="var(--forest)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
