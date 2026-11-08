"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { api, btnPrimary, input, Notice, type Msg } from "@/components/pharmacy/ui";
import { CATEGORY_LABEL, StatusBadge, whenIST } from "@/components/support/ui";

type Message = { id: string; authorName: string; fromPlatform: boolean; body: string; createdAt: string };
type Ticket = { id: string; number: string; subject: string; category: string; urgent: boolean; status: string; lastBy: string; createdAt: string; resolvedAt: string | null; messages: Message[] };

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const load = () => api<{ ticket: Ticket }>(`/api/support/tickets/${id}`).then((r) => (r.ok ? setT(r.data.ticket) : setError(r.error)));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await api(`/api/support/tickets/${id}/messages`, "POST", { body });
    if (r.ok) {
      setBody("");
      await load();
    } else {
      setMsg({ ok: false, text: r.error });
    }
    setBusy(false);
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/app/support" className="text-sm text-forest hover:underline">&larr; Help &amp; support</Link>
        <p className="rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">{error}</p>
      </div>
    );
  }
  if (!t) return <p className="text-sm text-ink/50">Loading...</p>;

  return (
    <div className="space-y-6">
      <Link href="/app/support" className="text-sm text-forest hover:underline">&larr; Help &amp; support</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl break-words sm:text-3xl">{t.subject}</h1>
          <p className="mt-1 text-xs text-ink/50">
            <span className="font-data">{t.number}</span> · {CATEGORY_LABEL[t.category] ?? t.category} · Opened {whenIST(t.createdAt)}
            {t.urgent && <span className="ml-2 rounded-full bg-clay-light px-2 py-0.5 text-clay">Urgent</span>}
          </p>
        </div>
        <StatusBadge status={t.status} />
      </div>

      <div className="space-y-3">
        {t.messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromPlatform ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[92%] rounded-2xl border px-4 py-3 sm:max-w-[75%] ${m.fromPlatform ? "border-forest/30 bg-forest/10" : "border-sand bg-white/70"}`}>
              <p className="text-xs text-ink/60">
                <span className="font-medium">{m.fromPlatform ? "ClinicOS team" : m.authorName}</span> · {whenIST(m.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <Card>
        {t.status === "RESOLVED" && <p className="mb-3 text-sm text-ink/60">This query is resolved. Reply to reopen.</p>}
        <form onSubmit={send} className="space-y-3">
          <textarea className={`${input} w-full`} rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required placeholder="Write a reply" aria-label="Reply" />
          <Notice msg={msg} />
          <button type="submit" className={btnPrimary} disabled={busy || !body.trim()}>{busy ? "Sending..." : "Send reply"}</button>
        </form>
      </Card>
    </div>
  );
}
