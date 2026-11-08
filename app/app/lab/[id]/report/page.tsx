"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ageOf, day, when } from "@/components/lab/shared";
import { api, btnPrimary } from "@/components/pharmacy/ui";

type Item = { id: string; testName: string; unit: string | null; range: string; resultValue: string | null; flag: string | null; remarks: string | null };
type Order = {
  orderNo: string; status: string; createdAt: string; collectedAt: string | null; resultedAt: string | null; orderedBy: string | null; clinicalNotes: string | null;
  patient: { name: string; uhid: string | null; gender: string | null; dob: string | null; phone: string };
  clinic: { name: string; address: string | null; phone: string | null }; items: Item[]; amendments: unknown[];
};

const MARK: Record<string, string> = { LOW: "L", HIGH: "H", CRITICAL: "CRITICAL" };

export default function LabReportPage() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ order: Order }>(`/api/lab/orders/${id}`).then((r) => (r.ok ? setO(r.data.order) : setErr(r.error)));
  }, [id]);

  if (err) return <p className="text-sm text-clay">{err}</p>;
  if (!o) return <p className="text-sm text-ink/60">Loading...</p>;
  const age = ageOf(o.patient.dob);
  const draft = o.status !== "RESULTED";

  return (
    <div className="space-y-4">
      <style>{`@media print { body * { visibility: hidden } #lab-report, #lab-report * { visibility: visible } #lab-report { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important } }`}</style>
      <div className="flex gap-3 print:hidden">
        <Link href={`/app/lab/${id}`} className="text-sm text-forest hover:underline">Back to order</Link>
        <button onClick={() => window.print()} className={btnPrimary}>Print</button>
      </div>
      <div id="lab-report" className="mx-auto max-w-3xl bg-white p-10 text-black shadow">
        <h1 className="text-2xl font-bold">{o.clinic.name}</h1>
        <p className="text-sm">{[o.clinic.address, o.clinic.phone].filter(Boolean).join(" · ")}</p>
        <hr className="my-3 border-black" />
        <h2 className="text-lg font-bold">Laboratory report</h2>
        {draft && <p className="text-sm font-bold">PRELIMINARY: some results are still pending</p>}
        <div className="mt-2 grid grid-cols-2 gap-x-6 text-sm">
          <p><strong>{o.patient.name}</strong> · {[o.patient.gender, age !== null ? `${age} yrs` : null].filter(Boolean).join(", ")}</p>
          <p>Order <strong>{o.orderNo}</strong></p>
          <p>UHID {o.patient.uhid ?? "-"} · {o.patient.phone}</p>
          <p>Ordered {day(o.createdAt)}{o.orderedBy ? ` by ${o.orderedBy}` : ""}</p>
          <p>{o.collectedAt ? `Sample collected ${when(o.collectedAt)}` : ""}</p>
          <p>{o.resultedAt ? `Reported ${when(o.resultedAt)}` : ""}</p>
        </div>
        {o.clinicalNotes && <p className="mt-2 text-sm"><strong>Clinical notes:</strong> {o.clinicalNotes}</p>}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-black text-left"><th className="py-1">Test</th><th className="py-1">Result</th><th className="py-1">Flag</th><th className="py-1">Unit</th><th className="py-1">Reference range</th></tr>
          </thead>
          <tbody>
            {o.items.map((i) => {
              const abn = i.flag && i.flag !== "NORMAL";
              return (
                <tr key={i.id} className="border-b border-black/20 align-top">
                  <td className="py-1">{i.testName}{i.remarks && <div className="text-xs">{i.remarks}</div>}</td>
                  <td className={`py-1 ${abn ? "font-bold" : ""}`}>{i.resultValue ?? "Pending"}</td>
                  <td className="py-1 font-bold">{i.flag ? MARK[i.flag] ?? "" : ""}</td>
                  <td className="py-1">{i.unit}</td>
                  <td className="py-1">{i.range}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-xs">H = above range, L = below range. {o.amendments.length > 0 ? "This report contains corrected values." : ""} Results should be interpreted by a doctor with the clinical picture.</p>
      </div>
    </div>
  );
}
