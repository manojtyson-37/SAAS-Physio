"use client";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const input = "rounded-lg border border-sand px-3 py-2 text-sm";
export const btnPrimary = "rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-50";
export const btnGhost = "rounded-lg border border-forest px-4 py-2 text-sm text-forest hover:bg-forest/5 disabled:opacity-50";

export type Msg = { ok: boolean; text: string } | null;

export function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-forest/10 text-forest" : "bg-clay-light text-clay"}`}>
      {msg.text}
    </p>
  );
}

const LEVEL: Record<string, string> = { OUT: "bg-clay-light text-clay", LOW: "bg-clay-light text-clay", OK: "bg-forest/10 text-forest" };
const LEVEL_TEXT: Record<string, string> = { OUT: "Out of stock", LOW: "Low", OK: "In stock" };
export const LevelBadge = ({ level }: { level: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs ${LEVEL[level] ?? "bg-sand text-ink/60"}`}>{LEVEL_TEXT[level] ?? level}</span>
);

const EXP: Record<string, string> = { EXPIRED: "bg-clay-light text-clay", EXPIRING: "bg-sand text-clay", OK: "text-ink/60", NONE: "text-ink/40" };
export const fmtDay = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "No expiry";
export const ExpiryTag = ({ date, status }: { date: string | null; status: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs ${EXP[status] ?? ""}`}>
    {fmtDay(date)}
    {status === "EXPIRED" ? " · expired" : status === "EXPIRING" ? " · soon" : ""}
  </span>
);

/** JSON call helper: returns the parsed body, or an error message from the API. */
export async function api<T = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: data as T } : { ok: false, error: (data as { error?: string }).error ?? "Something went wrong" };
  } catch {
    return { ok: false, error: "Network problem. Check your connection and try again" };
  }
}
