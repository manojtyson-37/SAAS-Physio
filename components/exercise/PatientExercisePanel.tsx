"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, fmtDate, StatusBadge } from "./ui";

type Plan = { id: string; title: string; status: string; startDate: string; itemCount: number; summary: { avgAdherence: number | null; latestPain: number | null } };

/** Compact exercise-plan summary for the patient page. */
export function PatientExercisePanel({ patientId }: { patientId: string }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<{ plans: Plan[] }>(`/api/exercise/plans?patientId=${patientId}`).then((r) => (r.ok ? setPlans(r.data.plans) : setError(r.error))); }, [patientId]);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">Exercise plans</h2>
        <Link href="/app/exercise/new" className="text-sm text-forest hover:underline">New plan</Link>
      </div>
      {error ? <p className="mt-2 text-sm text-clay">{error}</p> : plans === null ? <p className="mt-2 text-sm text-ink/50">Loading...</p> : plans.length === 0 ? (
        <p className="mt-2 text-sm text-ink/60">No exercise plans for this patient yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-sand/60 text-sm">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><Link href={`/app/exercise/${p.id}`} className="text-forest hover:underline">{p.title}</Link> <span className="text-xs text-ink/50">{p.itemCount} exercises · from {fmtDate(p.startDate)}</span></span>
              <span className="flex items-center gap-3 font-data text-xs text-ink/60">
                {p.summary.avgAdherence !== null && <span>{p.summary.avgAdherence}% adherence</span>}
                {p.summary.latestPain !== null && <span>pain {p.summary.latestPain}/10</span>}
                <StatusBadge status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
