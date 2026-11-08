"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ageOf, day, when } from "@/components/lab/shared";
import { api, btnPrimary } from "@/components/pharmacy/ui";
import { MODALITY_LABEL, type Modality } from "@/lib/radiology/logic";

type Order = {
  orderNo: string; status: string; studyName: string; modality: Modality; bodyPart: string | null; clinicalInfo: string | null; createdAt: string; performedAt: string | null;
  reportedAt: string | null; findings: string | null; impression: string | null; reportedBy: string | null; orderedBy: string | null; amendments: unknown[];
  patient: { name: string; uhid: string | null; gender: string | null; dob: string | null; phone: string };
  clinic: { name: string; address: string | null; phone: string | null };
};

export default function ImagingReportPage() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ order: Order }>(`/api/radiology/orders/${id}`).then((r) => (r.ok ? setO(r.data.order) : setErr(r.error)));
  }, [id]);

  if (err) return <p className="text-sm text-clay">{err}</p>;
  if (!o) return <p className="text-sm text-ink/60">Loading...</p>;
  const age = ageOf(o.patient.dob);

  return (
    <div className="space-y-4">
      <style>{`@media print { body * { visibility: hidden } #img-report, #img-report * { visibility: visible } #img-report { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important } }`}</style>
      <div className="flex gap-3 print:hidden">
        <Link href={`/app/radiology/${id}`} className="text-sm text-forest hover:underline">Back to order</Link>
        <button onClick={() => window.print()} className={btnPrimary}>Print</button>
      </div>
      <div id="img-report" className="mx-auto max-w-3xl bg-white p-10 text-black shadow">
        <h1 className="text-2xl font-bold">{o.clinic.name}</h1>
        <p className="text-sm">{[o.clinic.address, o.clinic.phone].filter(Boolean).join(" · ")}</p>
        <hr className="my-3 border-black" />
        <h2 className="text-lg font-bold">{MODALITY_LABEL[o.modality] ?? o.modality} report: {o.studyName}</h2>
        {o.status !== "REPORTED" && <p className="text-sm font-bold">NOT YET REPORTED</p>}
        <div className="mt-2 grid grid-cols-2 gap-x-6 text-sm">
          <p><strong>{o.patient.name}</strong> · {[o.patient.gender, age !== null ? `${age} yrs` : null].filter(Boolean).join(", ")}</p>
          <p>Order <strong>{o.orderNo}</strong></p>
          <p>UHID {o.patient.uhid ?? "-"} · {o.patient.phone}</p>
          <p>Ordered {day(o.createdAt)}{o.orderedBy ? ` by ${o.orderedBy}` : ""}</p>
          <p>{o.bodyPart ? `Region: ${o.bodyPart}` : ""}</p>
          <p>{o.performedAt ? `Performed ${when(o.performedAt)}` : ""}</p>
        </div>
        {o.clinicalInfo && <p className="mt-3 text-sm"><strong>Clinical information:</strong> {o.clinicalInfo}</p>}
        <h3 className="mt-4 font-bold">Findings</h3>
        <p className="whitespace-pre-wrap text-sm">{o.findings ?? "-"}</p>
        {o.impression && (<><h3 className="mt-4 font-bold">Impression</h3><p className="whitespace-pre-wrap text-sm font-semibold">{o.impression}</p></>)}
        <p className="mt-8 text-sm">{o.reportedBy ? <>Reported by <strong>{o.reportedBy}</strong>{o.reportedAt ? ` on ${when(o.reportedAt)}` : ""}</> : ""}{o.amendments.length > 0 ? " · corrected report" : ""}</p>
      </div>
    </div>
  );
}
