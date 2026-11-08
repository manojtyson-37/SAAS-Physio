"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, day, type AdmissionRow } from "./ui";

/** Compact list of a patient's admissions for the patient page. Renders nothing useful if the IPD module is off (the API returns 403). */
export default function PatientAdmissionsPanel({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<AdmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ admissions: AdmissionRow[] }>(`/api/ipd/admissions?patientId=${encodeURIComponent(patientId)}`).then((r) => {
      if (r.ok) setRows(r.data.admissions);
      else setError(r.error);
    });
  }, [patientId]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">Admissions</h2>
        <Link href={`/app/ipd/admit?patientId=${patientId}`} className="text-sm text-forest hover:underline">Admit</Link>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
      {!error && rows === null && <p className="text-sm text-ink/50">Loading...</p>}
      {rows && rows.length === 0 && <p className="text-sm text-ink/60">No admissions yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-sand/60 text-sm">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <Link href={`/app/ipd/${a.id}`} className="font-data text-forest hover:underline">{a.admissionNo}</Link>
                <span className="ml-2 text-ink/60">{a.diagnosis ?? a.reason ?? "No diagnosis recorded"}</span>
              </span>
              <span className="text-xs text-ink/50">
                {a.status === "ADMITTED" ? `In ${a.bed ? `${a.bed.wardName} ${a.bed.label}` : "ward"} since ${day(a.admittedAt)}` : `${day(a.admittedAt)} to ${day(a.dischargedAt)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
