"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { CONDITION_STYLE, toothName, type Condition } from "@/lib/dental/fdi";
import { api, paise, PlanBadge } from "./ui";

type Rec = { id: string; tooth: number; condition: string; surfaces: string | null };
type Plan = { id: string; title: string; status: string; totals: { planned: number; done: number } };

/** Compact dental summary for the patient page: findings count by condition and treatment plans. */
export function PatientDentalPanel({ patientId }: { patientId: string }) {
  const [teeth, setTeeth] = useState<Rec[] | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ teeth: Rec[] }>(`/api/dental/chart/${patientId}`).then((r) => (r.ok ? setTeeth(r.data.teeth) : setError(r.error)));
    api<{ plans: Plan[] }>(`/api/dental/plans?patientId=${patientId}`).then((r) => { if (r.ok) setPlans(r.data.plans); });
  }, [patientId]);

  const abnormal = useMemo(() => (teeth ?? []).filter((t) => t.condition !== "HEALTHY"), [teeth]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">Dental</h2>
        <Link href={`/app/dental/chart/${patientId}`} className="text-sm text-forest hover:underline">Open chart</Link>
      </div>
      {error ? <p className="mt-2 text-sm text-clay">{error}</p> : teeth === null ? <p className="mt-2 text-sm text-ink/50">Loading...</p> : abnormal.length === 0 ? (
        <p className="mt-2 text-sm text-ink/60">No dental findings recorded.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {abnormal.map((t) => (
            <span key={t.id} title={toothName(t.tooth)} className="rounded-full border px-2 py-0.5 text-xs" style={{ background: CONDITION_STYLE[t.condition as Condition]?.fill, borderColor: CONDITION_STYLE[t.condition as Condition]?.stroke }}>
              {t.tooth} {CONDITION_STYLE[t.condition as Condition]?.label ?? t.condition}
            </span>
          ))}
        </div>
      )}
      <h3 className="mt-4 text-sm font-medium">Treatment plans</h3>
      {plans === null ? null : plans.length === 0 ? <p className="mt-1 text-sm text-ink/60">No plans yet. <Link href={`/app/dental?patientId=${patientId}`} className="text-forest hover:underline">Create one</Link></p> : (
        <ul className="mt-1 divide-y divide-sand/60 text-sm">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link href={`/app/dental/${p.id}`} className="text-forest hover:underline">{p.title}</Link>
              <span className="flex items-center gap-3"><span className="font-data text-xs text-ink/60">{paise(p.totals.done + p.totals.planned)}</span><PlanBadge status={p.status} /></span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
