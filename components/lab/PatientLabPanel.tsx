"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { FlagBadge, StatusBadge, day } from "@/components/lab/shared";
import { api } from "@/components/pharmacy/ui";

type Trend = { testName: string; unit: string | null; refLow: number | null; refHigh: number | null; history: { value: number; flag: string | null }[] };
type Ord = { id: string; orderNo: string; status: string; createdAt: string; tests: number; abnormal: number };

/** Tiny inline trend line; the last point is highlighted when it is outside the range. */
function Spark({ t }: { t: Trend }) {
  const v = t.history.map((h) => h.value);
  if (v.length < 2) return <span className="text-xs text-ink/40">single result</span>;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 80},${22 - ((x - lo) / span) * 20}`);
  const last = t.history[t.history.length - 1];
  const bad = last.flag && last.flag !== "NORMAL";
  return (
    <svg width="84" height="24" role="img" aria-label={`Trend of ${t.testName}`}>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" className="text-forest" points={pts.join(" ")} />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" className={bad ? "fill-clay" : "fill-forest"} />
    </svg>
  );
}

/** Embeddable card for the patient page: recent lab orders and the latest numeric result per test with a trend. */
export default function PatientLabPanel({ patientId }: { patientId: string }) {
  const [data, setData] = useState<{ orders: Ord[]; trends: Trend[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ orders: Ord[]; trends: Trend[] }>(`/api/lab/patients/${patientId}`).then((r) => (r.ok ? setData(r.data) : setErr(r.error)));
  }, [patientId]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Lab results</h2>
        <Link href={`/app/lab/new?patientId=${patientId}`} className="text-sm text-forest hover:underline">New lab order</Link>
      </div>
      {err ? <p className="text-sm text-clay">{err}</p> : !data ? <p className="text-sm text-ink/60">Loading...</p> : data.orders.length === 0 ? (
        <p className="text-sm text-ink/60">No lab orders for this patient yet.</p>
      ) : (
        <>
          {data.trends.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {data.trends.map((t) => {
                    const last = t.history[t.history.length - 1];
                    return (
                      <tr key={t.testName} className="border-b border-sand/60 last:border-0">
                        <td className="py-1.5 pr-3">{t.testName}</td>
                        <td className="py-1.5 pr-3 font-data">{last.value} <span className="text-xs text-ink/50">{t.unit}</span></td>
                        <td className="py-1.5 pr-3"><FlagBadge flag={last.flag} /></td>
                        <td className="py-1.5"><Spark t={t} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {data.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/app/lab/${o.id}`} className="font-data text-forest hover:underline">{o.orderNo}</Link>
                <span className="text-xs text-ink/50">{day(o.createdAt)} · {o.tests} test{o.tests === 1 ? "" : "s"}</span>
                <StatusBadge status={o.status} />
                {o.abnormal > 0 && <span className="text-xs text-clay">{o.abnormal} abnormal</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
