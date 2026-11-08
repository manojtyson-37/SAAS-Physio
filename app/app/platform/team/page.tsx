"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { CredentialsCard, fmtDate, type Creds } from "@/components/platform/ui";
import { api, btnGhost, btnPrimary, input, Notice, type Msg } from "@/components/pharmacy/ui";

type U = { id: string; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean; createdAt: string };

export default function PlatformTeamPage() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [me, setMe] = useState("");
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [f, setF] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ users: U[]; me: string }>("/api/platform/team").then((r) => {
    if (r.ok) { setUsers(r.data.users); setMe(r.data.me); } else setDenied(true);
  }), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => setCreds(null), []);

  if (denied) return <Card><p className="text-sm text-ink/70">Only the platform owner can manage the platform team.</p><Link href="/app/platform" className="mt-2 inline-block text-sm text-forest hover:underline">Back to clinics</Link></Card>;

  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await api<{ user: { name: string; email: string }; tempPassword: string }>("/api/platform/team", "POST", f);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setCreds({ title: "Onboarding login created", lines: [{ label: "Name", value: r.data.user.name }, { label: "Email", value: r.data.user.email }], password: r.data.tempPassword });
    setF({ name: "", email: "" }); load();
  }
  async function toggle(u: U) {
    setMsg(null);
    const r = await api(`/api/platform/team/${u.id}`, "PATCH", { isActive: !u.isActive });
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    load();
  }
  async function reset(u: U) {
    if (!window.confirm(`Reset the password of ${u.name}?`)) return;
    setMsg(null);
    const r = await api<{ tempPassword: string }>(`/api/platform/team/${u.id}/reset-password`, "POST");
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setCreds({ title: "Password reset", lines: [{ label: "Name", value: u.name }, { label: "Email", value: u.email }], password: r.data.tempPassword });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Platform team</h1>
        <p className="mt-1 text-sm text-ink/60">Logins for the owner and the onboarding team. Onboarding can create clinics, set modules and trials; money and access decisions stay with the owner.</p>
      </div>
      <Notice msg={msg} />
      {creds && <CredentialsCard creds={creds} onClose={() => setCreds(null)} />}
      <Card>
        <h2 className="font-display text-xl">Add an onboarding login</h2>
        <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">Name<input required minLength={2} maxLength={100} className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm">Email<input required type="email" maxLength={120} className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <button disabled={busy} className={btnPrimary}>{busy ? "Adding..." : "Add login"}</button>
        </form>
      </Card>
      {users === null ? <p className="text-sm text-ink/50">Loading...</p> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm"><tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-sand/60 last:border-0">
                <td className="px-4 py-3">{u.name}{u.id === me && <span className="ml-2 text-xs text-ink/50">(you)</span>}<div className="text-xs text-ink/50">{u.email}</div></td>
                <td className="px-4 py-3 text-xs text-ink/60">{u.role === "SUPER_ADMIN" ? "Owner" : "Onboarding"} · {u.isActive ? "Active" : "Inactive"}{u.mustChangePassword ? " · must change password" : ""}</td>
                <td className="px-4 py-3 text-xs text-ink/50">{fmtDate(u.createdAt)}</td>
                <td className="space-x-2 px-4 py-3 text-right">
                  {u.role === "ONBOARDING" && <>
                    <button className={btnGhost} onClick={() => toggle(u)}>{u.isActive ? "Deactivate" : "Activate"}</button>
                    <button className={btnGhost} onClick={() => reset(u)}>Reset password</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody></table>
        </Card>
      )}
    </div>
  );
}
