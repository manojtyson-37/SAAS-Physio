"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import InvoiceForm, { FormValue } from "@/components/billing/InvoiceForm";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [form, setForm] = useState<FormValue | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const inv = d.invoice;
        if (!inv) return setBlocked("Invoice not found");
        setNumber(inv.number);
        if (inv.status === "CANCELLED") return setBlocked("A cancelled invoice cannot be edited");
        if (inv.payments.length > 0) return setBlocked("This invoice already has payments and can no longer be edited");
        setForm({
          lines: inv.lineItems.map((l: { description: string; qty: number; unitPrice: number; gstPercent: number }) => ({
            description: l.description, qty: String(l.qty), unitPrice: String(l.unitPrice), gstPercent: String(l.gstPercent),
          })),
          discount: inv.discount ? String(inv.discount) : "",
          notes: inv.notes ?? "",
        });
      });
  }, [id]);

  async function submit() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems: form.lines, discount: form.discount || 0, notes: form.notes || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Could not save changes");
      router.push(`/app/invoices/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href={`/app/invoices/${id}`} className="text-sm text-ink/50 hover:text-ink">← Back to invoice</Link>
      <h1 className="font-display text-3xl">Edit {number}</h1>
      {blocked ? (
        <p className="rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">{blocked}</p>
      ) : form ? (
        <Card>
          <InvoiceForm value={form} onChange={setForm} onSubmit={submit} submitLabel="Save changes" saving={saving} error={error} />
        </Card>
      ) : (
        <p className="text-sm text-ink/50">Loading…</p>
      )}
    </div>
  );
}
