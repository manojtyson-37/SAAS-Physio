"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api, fmtDate } from "@/components/exercise/ui";
import { prescriptionText } from "@/lib/exercise/logic";

type Plan = {
  title: string; startDate: string; endDate: string | null; notes: string | null; doctor: string | null; patient: { name: string; uhid: string | null };
  items: { id: string; name: string; sets: number | null; reps: number | null; holdSeconds: number | null; frequency: string | null; instructions: string | null }[];
};

/** Large-type patient handout. Screen shows a toolbar; print shows only the sheet. */
export default function HandoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<{ plan: Plan }>(`/api/exercise/plans/${id}`).then((r) => { if (r.ok) setPlan(r.data.plan); else setErr(r.error); }); }, [id]);

  if (err) return <p className="text-sm text-clay" role="alert">{err}</p>;
  if (!plan) return <p className="text-sm text-ink/50">Loading...</p>;
  return (
    <div className="space-y-4">
      <div className="flex gap-3 print:hidden">
        <Link href={`/app/exercise/${id}`} className="text-sm text-forest hover:underline">Back to plan</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">Print handout</button>
      </div>
      <style>{`@media print { body * { visibility: hidden } #handout, #handout * { visibility: visible } #handout { position: absolute; left: 0; top: 0; width: 100% } }`}</style>
      <div id="handout" className="rounded-2xl border border-sand bg-white p-8 text-black print:border-0 print:p-0">
        <h1 className="text-3xl font-bold">{plan.title}</h1>
        <p className="mt-2 text-lg">For: <strong>{plan.patient.name}</strong>{plan.patient.uhid ? ` (${plan.patient.uhid})` : ""}</p>
        <p className="text-base text-gray-700">Started {fmtDate(plan.startDate)}{plan.endDate ? ` · until ${fmtDate(plan.endDate)}` : ""}{plan.doctor ? ` · Dr ${plan.doctor.replace(/^Dr\.?\s*/i, "")}` : ""}</p>
        {plan.notes && <p className="mt-4 text-lg">{plan.notes}</p>}
        <ol className="mt-6 space-y-6">
          {plan.items.map((i, idx) => (
            <li key={i.id} className="break-inside-avoid border-b border-gray-300 pb-5">
              <h2 className="text-2xl font-semibold">{idx + 1}. {i.name}</h2>
              <p className="mt-1 text-xl font-medium">{prescriptionText(i)}</p>
              {i.instructions && <p className="mt-2 text-xl leading-relaxed">{i.instructions}</p>}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-lg">Stop and tell your physiotherapist if an exercise causes sharp pain, dizziness or numbness.</p>
      </div>
    </div>
  );
}
