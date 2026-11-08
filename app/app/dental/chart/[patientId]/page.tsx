"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ToothChart } from "@/components/dental/ToothChart";
import { api } from "@/components/dental/ui";

export default function ChartPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    api<{ patient: { name: string; uhid: string | null } }>(`/api/dental/chart/${patientId}`).then((r) => { if (r.ok) setName(`${r.data.patient.name}${r.data.patient.uhid ? ` · ${r.data.patient.uhid}` : ""}`); });
  }, [patientId]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Dental chart</h1>
          <p className="mt-1 text-sm text-ink/60">{name ?? " "}</p>
        </div>
        <Link href={`/app/dental?patientId=${patientId}`} className="text-sm text-forest hover:underline">Treatment plans</Link>
      </div>
      <ToothChart patientId={patientId} />
    </div>
  );
}
