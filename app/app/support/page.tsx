"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnPrimary, input, Notice, type Msg } from "@/components/pharmacy/ui";
import { CATEGORY_LABEL, StatusBadge, whenIST } from "@/components/support/ui";

type Ticket = { id: string; number: string; subject: string; category: string; urgent: boolean; status: string; lastBy: string; lastMessageAt: string; createdAt: string; messages: number };

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("QUESTION");
  const [urgent, setUrgent] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    api<{ tickets: Ticket[] }>("/api/support/tickets").then((r) => (r.ok ? setTickets(r.data.tickets) : setListError(r.error)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await api<{ ticket: { id: string } }>("/api/support/tickets", "POST", { subject, category, urgent, body });
    if (r.ok) {
      router.push(`/app/support/${r.data.ticket.id}`);
      return;
    }
    setMsg({ ok: false, text: r.error });
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Help &amp; support</h1>
        <p className="mt-1 text-sm text-ink/60">Ask the ClinicOS team a question or report a problem. We reply here.</p>
      </div>

      <Card>
        <h2 className="font-display text-xl">New query</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink/70">Subject</span>
              <input className={`${input} mt-1 w-full`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} required placeholder="A short summary" />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Type</span>
              <select className={`${input} mt-1 w-full bg-white`} value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-ink/70">Message</span>
            <textarea className={`${input} mt-1 w-full`} rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required placeholder="Tell us what you need or what went wrong" />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            <span>
              Urgent <span className="text-ink/50">(only when patient care is affected)</span>
            </span>
          </label>
          <Notice msg={msg} />
          <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "Sending..." : "Send query"}</button>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-xl">Your queries</h2>
        {listError ? (
          <p className="mt-3 rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">{listError}</p>
        ) : tickets === null ? (
          <p className="mt-3 text-sm text-ink/50">Loading...</p>
        ) : tickets.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">No queries yet. Use the form above to ask us anything.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sand">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/app/support/${t.id}`}
                  className={`flex flex-wrap items-center justify-between gap-2 px-2 py-3 hover:bg-sand/40 ${t.status === "WAITING_CLINIC" ? "border-l-4 border-clay bg-clay-light/30" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="font-data text-ink/50">{t.number}</span> {t.subject}
                      {t.urgent && <span className="ml-2 rounded-full bg-clay-light px-2 py-0.5 text-xs text-clay">Urgent</span>}
                    </p>
                    <p className="text-xs text-ink/50">{CATEGORY_LABEL[t.category] ?? t.category} · Last activity {whenIST(t.lastMessageAt)}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
