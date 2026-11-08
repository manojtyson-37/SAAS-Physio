"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const box = "mx-auto mt-16 max-w-md rounded-2xl border border-sand bg-white p-8";
const field = "mt-1 block w-full rounded-lg border border-sand px-3 py-2 text-sm";

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

/** Shown instead of the app when the clinic is suspended or the user's access has been ended. */
export function AccessEnded({ title, body }: { title: string; body: string }) {
  return (
    <div className={box}>
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-3 text-sm text-ink/70">{body}</p>
      <button onClick={signOut} className="mt-6 rounded-lg border border-forest px-4 py-2 text-sm text-forest hover:bg-forest/5">Sign out</button>
    </div>
  );
}

/** First sign-in with a temporary password: the user must choose their own before anything else. */
export function ForcePasswordChange() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next !== again) return setErr("The two new passwords do not match");
    setBusy(true);
    const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr((data as { error?: string }).error ?? "Could not change the password");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={box}>
      <h1 className="font-display text-2xl">Choose your own password</h1>
      <p className="mt-2 text-sm text-ink/70">You signed in with a temporary password. Set a new one (at least 10 characters) to continue.</p>
      {err && <p role="alert" className="mt-3 rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">{err}</p>}
      <label className="mt-4 block text-sm">Temporary password<input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={field} /></label>
      <label className="mt-3 block text-sm">New password<input type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} className={field} /></label>
      <label className="mt-3 block text-sm">New password again<input type="password" autoComplete="new-password" required minLength={10} value={again} onChange={(e) => setAgain(e.target.value)} className={field} /></label>
      <div className="mt-6 flex items-center gap-4">
        <button disabled={busy} className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-50">{busy ? "Saving…" : "Save password"}</button>
        <button type="button" onClick={signOut} className="text-sm text-ink/50 hover:text-ink">Sign out</button>
      </div>
    </form>
  );
}
