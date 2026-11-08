"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { StatusBadge, day } from "@/components/lab/shared";
import { api } from "@/components/pharmacy/ui";

type Ord = { id: string; orderNo: string; status: string; studyName: string; createdAt: string; impression: string | null };

/** Embeddable card for the patient page: recent imaging studies with their impression. */
export default function PatientImagingPanel({ patientId }: { patientId: string }) {
  const [orders, setOrders] = useState<Ord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ orders: Ord[] }>(`/api/radiology/patients/${patientId}`).then((r) => (r.ok ? setOrders(r.data.orders) : setErr(r.error)));
  }, [patientId]);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Imaging</h2>
        <Link href={`/app/radiology/new?patientId=${patientId}`} className="text-sm text-forest hover:underline">New imaging order</Link>
      </div>
      {err ? <p className="text-sm text-clay">{err}</p> : !orders ? <p className="text-sm text-ink/60">Loading...</p> : orders.length === 0 ? (
        <p className="text-sm text-ink/60">No imaging studies for this patient yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {orders.map((o) => (
            <li key={o.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/app/radiology/${o.id}`} className="text-forest hover:underline">{o.studyName}</Link>
                <span className="font-data text-xs text-ink/50">{o.orderNo} · {day(o.createdAt)}</span>
                <StatusBadge status={o.status} />
              </div>
              {o.impression && <p className="mt-0.5 text-xs text-ink/70">Impression: {o.impression}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
