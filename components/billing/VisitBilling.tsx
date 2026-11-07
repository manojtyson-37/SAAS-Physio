"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { inr } from "./InvoiceForm";
import { statusClass } from "./status";

type Row = { id: string; number: string; total: number; balance: number; status: string };

/** Bills raised for one OPD visit, with a shortcut to raise another. */
export default function VisitBilling({ visitId, patientId, role }: { visitId: string; patientId: string; role: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch(`/api/invoices?visitId=${encodeURIComponent(visitId)}`)
      .then((r) => (r.ok ? r.json() : { invoices: [] }))
      .then((d) => setRows(d.invoices))
      .catch(() => setRows([]));
  }, [visitId]);

  const canBill = role === "CLINIC_ADMIN" || role === "STAFF";
  const live = rows?.filter((r) => r.status !== "CANCELLED") ?? [];

  return (
    <Card className="print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Billing</h2>
        {canBill && (
          <Link
            href={`/app/invoices/new?patientId=${patientId}&visitId=${visitId}`}
            className="rounded-full bg-forest px-4 py-1.5 text-sm font-medium text-cream hover:bg-forest-deep"
          >
            {live.length ? "+ Another bill" : "Create bill"}
          </Link>
        )}
      </div>
      {rows && rows.length === 0 && <p className="mt-2 text-sm text-ink/50">No bill raised for this visit yet.</p>}
      <ul className="mt-2 divide-y divide-sand/60">
        {rows?.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
            <Link href={`/app/invoices/${r.id}`} className="font-data hover:text-forest">{r.number}</Link>
            <span className="font-data">{inr(r.total)}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(r.status)}`}>
              {r.status === "PAID" || r.status === "CANCELLED" ? r.status.toLowerCase() : `${inr(r.balance)} due`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
