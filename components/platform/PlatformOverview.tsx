"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, StatCard } from "@/components/Card";
import { StateBadge, fmtDate } from "@/components/platform/ui";
import { api, inr } from "@/components/pharmacy/ui";

type Overview = {
  clinics: { total: number; onTrial: number; paid: number; ended: number; suspended: number };
  onboardings: {
    last7: number;
    last30: number;
    notYetSignedIn: number;
    recent: { id: string; name: string; type: string; createdAt: string; state: string; daysLeft: number | null; plan: string | null; adminSignedIn: boolean }[];
  };
  trialsEnding: { id: string; name: string; daysLeft: number; endsAt: string }[];
  renewalsDue: { id: string; name: string; daysLeft: number; state: string; paidThrough: string | null }[];
  queries: {
    open: number;
    urgent: number;
    waitingOnUs: number;
    oldestWaitingHours: number | null;
    latest: { id: string; number: number; subject: string; category: string; urgent: boolean; status: string; needsUs: boolean; waitingHours: number; clinic: { id: string; name: string } }[];
  };
  revenue: null | {
    thisMonth: number;
    last30: number;
    allTime: number;
    payments: number;
    byMonth: { month: string; amount: number }[];
    recent: { id: string; clinic: string; amount: number; plan: string | null; at: string }[];
  };
};

const eyebrow = "font-data text-[10px] uppercase tracking-widest text-ink/40";
const axis = { fontSize: 11, fill: "var(--sage)" };
const link = "text-forest hover:underline";
const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

export default function PlatformOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Overview>("/api/platform/overview").then((r) => (r.ok ? setData(r.data) : setErr(r.error)));
  }, []);

  if (err) return <p className="text-sm text-clay">Could not load the overview: {err}</p>;
  if (!data) return <p className="text-sm text-ink/50">Loading overview...</p>;

  const { clinics: c, onboardings: o, queries: q, revenue: rev } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Platform overview</h1>
        <p className="mt-1 text-sm text-ink/60">Clinics, onboarding, support and revenue</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clinics" value={String(c.total)} sub={`${c.onTrial} on trial · ${c.paid} paid · ${c.ended} ended · ${c.suspended} suspended`} />
        <StatCard label="New onboardings" value={String(o.last7)} sub={`last 7 days · ${o.last30} in 30 days · ${o.notYetSignedIn} admins not yet signed in`} />
        {rev && <StatCard label="Revenue this month" value={inr(rev.thisMonth)} sub={`last 30 days ${inr(rev.last30)} · all time ${inr(rev.allTime)}`} />}
        <StatCard
          label="Queries waiting on us"
          value={String(q.waitingOnUs)}
          sub={`${q.open} open · ${q.urgent} urgent${q.oldestWaitingHours !== null ? ` · oldest waiting ${q.oldestWaitingHours} h` : ""}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <p className={eyebrow}>Onboarding</p>
          <p className="mt-1 font-display text-lg">Recent onboardings</p>
          {o.recent.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">No clinics onboarded yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink/50">
                    <th className="py-1 pr-4 font-normal">Clinic</th>
                    <th className="py-1 pr-4 font-normal">Type</th>
                    <th className="py-1 pr-4 font-normal">Onboarded</th>
                    <th className="py-1 pr-4 font-normal">State</th>
                    <th className="py-1 pr-4 font-normal">Plan</th>
                    <th className="py-1 font-normal">Admin signed in</th>
                  </tr>
                </thead>
                <tbody>
                  {o.recent.map((r) => (
                    <tr key={r.id} className="border-t border-sand/60">
                      <td className="py-2 pr-4"><Link href={`/app/platform/${r.id}`} className={link}>{r.name}</Link></td>
                      <td className="py-2 pr-4 text-ink/60">{r.type}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-ink/60">{fmtDate(r.createdAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <StateBadge state={r.state} />
                        {r.daysLeft !== null && <span className="ml-2 text-xs text-ink/50">{days(r.daysLeft)} left</span>}
                      </td>
                      <td className="py-2 pr-4 text-ink/60">{r.plan ?? "Not set"}</td>
                      <td className="py-2">{r.adminSignedIn ? <span className="text-forest" aria-label="Signed in">&#10003;</span> : <span className="text-xs text-clay">Not yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={eyebrow}>Support</p>
              <p className="mt-1 font-display text-lg">Open queries</p>
            </div>
            <Link href="/app/platform/support" className="rounded-full border border-ink/15 px-4 py-1.5 text-sm hover:border-ink/30">View all</Link>
          </div>
          {q.latest.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">No open queries. Clinics can raise one from their Help page.</p>
          ) : (
            <ul className="mt-4 divide-y divide-sand/60">
              {q.latest.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  <Link href={`/app/platform/support/${t.id}`} className="block hover:bg-sand/30">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-data text-xs text-ink/40">#{t.number}</span>
                      {t.urgent && <span className="rounded-full bg-clay-light px-2 py-0.5 text-xs text-clay">Urgent</span>}
                      <span className="font-medium">{t.subject}</span>
                    </div>
                    <div className="text-xs text-ink/50">
                      {t.clinic.name} · {t.status.replace(/_/g, " ").toLowerCase()}{t.needsUs ? ` · waiting ${t.waitingHours} h` : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className={eyebrow}>Revenue</p>
          <p className="mt-1 font-display text-lg">Last 6 months</p>
          {!rev || rev.payments === 0 ? (
            <p className="mt-4 text-sm text-ink/50">Payments appear here when you activate or renew a clinic with an amount.</p>
          ) : (
            <>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rev.byMonth}>
                    <CartesianGrid stroke="var(--sand)" vertical={false} />
                    <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => inr(Number(v))} />
                    <Bar dataKey="amount" fill="var(--forest)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 divide-y divide-sand/60 text-sm">
                {rev.recent.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{p.clinic}{p.plan && <span className="ml-2 text-xs text-ink/50">{p.plan}</span>}</span>
                    <span><span className="font-data">{inr(p.amount)}</span><span className="ml-2 text-xs text-ink/50">{fmtDate(p.at)}</span></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <p className={eyebrow}>Trials</p>
          <p className="mt-1 font-display text-lg">Trials ending in 7 days</p>
          {data.trialsEnding.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">No trials ending this week.</p>
          ) : (
            <ul className="mt-4 divide-y divide-sand/60 text-sm">
              {data.trialsEnding.map((t) => (
                <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <Link href={`/app/platform/${t.id}`} className={link}>{t.name}</Link>
                  <span className="text-xs text-ink/50">{days(t.daysLeft)} left · ends {fmtDate(t.endsAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className={eyebrow}>Renewals</p>
          <p className="mt-1 font-display text-lg">Renewals due</p>
          {data.renewalsDue.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">No renewals due soon.</p>
          ) : (
            <ul className="mt-4 divide-y divide-sand/60 text-sm">
              {data.renewalsDue.map((t) => (
                <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <Link href={`/app/platform/${t.id}`} className={link}>{t.name}</Link>
                  <span className="text-xs text-ink/50">
                    {t.daysLeft < 0 ? `${days(-t.daysLeft)} overdue` : `${days(t.daysLeft)} left`}{t.paidThrough ? ` · paid through ${fmtDate(t.paidThrough)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
