"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { inr } from "@/components/billing/InvoiceForm";
import { statusClass } from "@/components/billing/status";

type Invoice = {
  id: string;
  number: string;
  date: string;
  patient: { id: string; name: string; uhid: string | null };
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
};
type Report = {
  date: string;
  collected: number;
  byMethod: { method: string; amount: number; count: number }[];
  billed: number;
  invoiceCount: number;
  outstanding: number;
  openInvoices: number;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const TABS = [
  { key: "", label: "All" },
  { key: "UNPAID", label: "Unpaid" },
  { key: "PARTIAL", label: "Partial" },
  { key: "PAID", label: "Paid" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/invoices?${params}`);
    if (!res.ok) return setError("Could not load invoices");
    setError(null);
    setInvoices((await res.json()).invoices);
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    // Doctors are not allowed to see the cash report; the card simply stays hidden for them.
    fetch("/api/invoices/report")
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Billing</h1>
          <p className="mt-1 text-sm text-ink/60">{invoices?.length ?? 0} invoices shown</p>
        </div>
        <Link href="/app/invoices/new" className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep">
          + New invoice
        </Link>
      </div>

      {report && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-[10px] uppercase tracking-widest text-ink/40">Collected today</p>
            <p className="mt-1 font-display text-2xl">{inr(report.collected)}</p>
            <p className="mt-1 text-xs text-ink/50">
              {report.byMethod.length
                ? report.byMethod.map((m) => `${m.method} ${inr(m.amount)}`).join(" · ")
                : "No payments yet"}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] uppercase tracking-widest text-ink/40">Billed today</p>
            <p className="mt-1 font-display text-2xl">{inr(report.billed)}</p>
            <p className="mt-1 text-xs text-ink/50">{report.invoiceCount} invoices</p>
          </Card>
          <Card>
            <p className="text-[10px] uppercase tracking-widest text-ink/40">Outstanding dues</p>
            <p className="mt-1 font-display text-2xl">{inr(report.outstanding)}</p>
            <p className="mt-1 text-xs text-ink/50">{report.openInvoices} open invoices</p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`rounded-full px-3 py-1 text-xs ${status === t.key ? "bg-forest text-cream" : "bg-sand/60 text-ink/70 hover:bg-sand"}`}
          >
            {t.label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search invoice #, patient or UHID"
          className="ml-auto w-full rounded-lg border border-sand px-3 py-1.5 text-sm sm:w-72"
        />
      </div>

      {error && <p role="alert" className="text-sm text-clay">{error}</p>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-[10px] uppercase tracking-widest text-ink/40">
              <th className="px-6 py-3">Invoice #</th>
              <th className="px-6 py-3">Patient</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Total</th>
              <th className="px-6 py-3">Balance</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv) => (
              <tr key={inv.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/20">
                <td className="px-6 py-3">
                  <Link href={`/app/invoices/${inv.id}`} className="font-data hover:text-forest">{inv.number}</Link>
                </td>
                <td className="px-6 py-3">
                  {inv.patient.name}
                  {inv.patient.uhid && <span className="ml-2 font-data text-xs text-ink/40">{inv.patient.uhid}</span>}
                </td>
                <td className="px-6 py-3 text-ink/70">{fmtDate(inv.date)}</td>
                <td className="px-6 py-3 font-data font-medium">{inr(inv.total)}</td>
                <td className="px-6 py-3 font-data">{inr(inv.balance)}</td>
                <td className="px-6 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(inv.status)}`}>{inv.status.toLowerCase()}</span>
                </td>
              </tr>
            ))}
            {invoices?.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-ink/50">No invoices match.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
