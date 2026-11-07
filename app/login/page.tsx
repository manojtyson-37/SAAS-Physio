"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PulseMark } from "@/components/PulseMark";
import { BRAND } from "@/lib/brand";
import { DEMO_GROUPS, DEMO_PASSWORD, SUPER_ADMIN_DEMO } from "@/lib/demoAccounts";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push("/app");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-forest-deep lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-deep via-forest to-forest-deep/90" />
        <div className="relative flex h-full flex-col justify-between p-12 text-cream">
          <div className="flex items-center gap-2.5">
            <PulseMark className="h-9 w-9" />
            <div className="leading-tight">
              <div className="font-display text-lg font-medium">{BRAND.name}</div>
              <div className="font-data text-[10px] uppercase tracking-[0.18em] text-cream/60">
                {BRAND.descriptor}
              </div>
            </div>
          </div>
          <div>
            <p className="font-data text-xs uppercase tracking-[0.2em] text-clay">
              Physio · Dental · Ortho · General · Hospital
            </p>
            <h1 className="mt-4 max-w-md font-display text-4xl font-medium leading-tight">
              One platform. Switch on only the modules your clinic needs.
            </h1>
            <p className="mt-6 max-w-sm text-cream/70">
              OPD queue, prescriptions, billing, appointments, packages and more,
              for clinics and small hospitals of every kind.
            </p>
          </div>
          <p className="text-xs text-cream/40">© {new Date().getFullYear()} {BRAND.name}</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="font-display text-2xl font-medium">Sign in</h2>
          <p className="mt-2 text-sm text-ink/60">
            Welcome back — enter your credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-medium text-ink/70">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                className="mt-1 w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink/70">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>
            {error && <p className="text-sm text-clay">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-forest py-2.5 text-sm font-medium text-cream transition hover:bg-forest-deep disabled:opacity-60"
            >
              {loading ? "Signing in…" : "→ Sign in"}
            </button>
          </form>

          <div className="mt-8">
            <p className="font-data text-[10px] uppercase tracking-widest text-ink/40">Demo clinics</p>
            <p className="mt-1 text-xs text-ink/50">Pick an account to fill the form. Password for all: {DEMO_PASSWORD}</p>
            <div className="mt-3 space-y-3">
              {DEMO_GROUPS.map((g) => (
                <div key={g.clinic} className="rounded-lg border border-sand p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium">{g.clinic}</span>
                    <span className="text-[10px] uppercase tracking-wide text-ink/40">{g.type}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.accounts.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => {
                          setEmail(acc.email);
                          setPassword(DEMO_PASSWORD);
                        }}
                        className={`rounded-full border px-3 py-1 text-xs transition hover:border-forest ${email === acc.email ? "border-forest bg-forest/5 text-forest" : "border-sand text-ink/70"}`}
                      >
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEmail(SUPER_ADMIN_DEMO.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="text-xs text-ink/50 hover:text-ink"
              >
                {SUPER_ADMIN_DEMO.label} →
              </button>
            </div>
          </div>

          <Link href="/" className="mt-8 inline-block text-xs text-ink/50 hover:text-ink">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
