"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { fmtDateTime } from "@/components/platform/ui";
import { api, btnGhost, btnPrimary, input, Notice, type Msg } from "@/components/pharmacy/ui";

type Thread = {
  id: string; number: number; subject: string; category: string; urgent: boolean; status: string; lastBy: string | null;
  createdAt: string; resolvedAt: string | null; mine: boolean;
  tenant: { id: string; name: string; clinicType: string };
  messages: { id: string; authorName: string; fromPlatform: boolean; body: string; createdAt: string }[];
};
const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function SupportThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<Thread | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState("");

  const load = useCallback(() => api<{ ticket: Thread }>(`/api/platform/support/${id}`).then((r) => (r.ok ? setT(r.data.ticket) : setErr(r.error))), [id]);
  useEffect(() => { load(); }, [load]);

  async function patch(data: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const r = await api(`/api/platform/support/${id}`, "PATCH", data);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    await load();
  }
  async function reply(resolve: boolean) {
    if (!body.trim()) return setMsg({ ok: false, text: "Write a reply first" });
    setBusy(true); setMsg(null);
    const r = await api(`/api/platform/support/${id}/reply`, "POST", { body: body.trim(), ...(resolve ? { status: "RESOLVED" } : {}) });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setBody(""); setMsg({ ok: true, text: resolve ? "Reply sent and query resolved" : "Reply sent" }); await load();
  }

  const back = <Link href="/app/platform/support" className="text-sm text-forest hover:underline">Back to queries</Link>;
  if (err) return <div className="space-y-4">{back}<Notice msg={{ ok: false, text: err }} /></div>;
  if (!t) return <p className="text-sm text-ink/50">Loading...</p>;
  const resolved = t.status === "RESOLVED";

  return (
    <div className="space-y-6">
      {back}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">#{t.number} {t.subject}</h1>
          {t.urgent && <span className="rounded-full bg-clay-light px-2.5 py-0.5 text-xs text-clay">Urgent</span>}
          <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs text-ink/70">{label(t.status)}</span>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          <Link href={`/app/platform/${t.tenant.id}`} className="text-forest hover:underline">{t.tenant.name}</Link> · {label(t.category)} · opened {fmtDateTime(t.createdAt)}{t.mine ? " · assigned to you" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!t.mine && <button disabled={busy} className={btnGhost} onClick={() => patch({ assignToMe: true })}>Take it</button>}
        {!resolved && t.status !== "IN_PROGRESS" && <button disabled={busy} className={btnGhost} onClick={() => patch({ status: "IN_PROGRESS" })}>In progress</button>}
        <button disabled={busy} className={btnGhost} onClick={() => patch({ urgent: !t.urgent })}>{t.urgent ? "Clear urgent" : "Mark urgent"}</button>
        {resolved ? <button disabled={busy} className={btnGhost} onClick={() => patch({ status: "OPEN" })}>Reopen</button> : <button disabled={busy} className={btnGhost} onClick={() => patch({ status: "RESOLVED" })}>Resolve</button>}
      </div>

      <div className="space-y-3">
        {t.messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromPlatform ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.fromPlatform ? "bg-forest/10" : "border border-sand bg-white/60"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className="mt-2 text-xs text-ink/50">{m.authorName}{m.fromPlatform ? " (platform)" : ""} · {fmtDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="font-display text-xl">Reply</h2>
        <textarea className={`${input} min-h-28 w-full`} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply to the clinic" />
        <Notice msg={msg} />
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={btnPrimary} onClick={() => reply(false)}>Send reply</button>
          {!resolved && <button disabled={busy} className={btnGhost} onClick={() => reply(true)}>Reply and resolve</button>}
        </div>
      </Card>
    </div>
  );
}
