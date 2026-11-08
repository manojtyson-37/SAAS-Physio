"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { btnGhost } from "@/components/pharmacy/ui";

export const STATE_LABEL: Record<string, string> = {
  TRIAL: "Trial", TRIAL_EXPIRED: "Trial ended", ACTIVE: "Active", GRACE: "Grace period",
  PAID_EXPIRED: "Expired", SUSPENDED: "Suspended", CANCELLED: "Cancelled",
};
const STATE_CLASS: Record<string, string> = {
  TRIAL: "bg-sand text-ink/70", ACTIVE: "bg-forest/10 text-forest", GRACE: "bg-sand text-clay",
  TRIAL_EXPIRED: "bg-clay-light text-clay", PAID_EXPIRED: "bg-clay-light text-clay", SUSPENDED: "bg-clay-light text-clay", CANCELLED: "bg-sand text-ink/50",
};

export type Sub = {
  status: string; state: string; access: string; daysLeft: number | null; plan: string | null;
  trialStartedAt: string | null; trialEndsAt: string | null; paidThrough: string | null; note: string | null;
};

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "None";
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function stateDetail(s: Sub): string {
  if (s.state === "TRIAL" && s.daysLeft !== null) return `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`;
  if ((s.state === "ACTIVE" || s.state === "GRACE") && s.paidThrough) return `paid to ${fmtDate(s.paidThrough)}`;
  if (s.state === "TRIAL_EXPIRED" && s.trialEndsAt) return `ended ${fmtDate(s.trialEndsAt)}`;
  if (s.state === "PAID_EXPIRED" && s.paidThrough) return `ended ${fmtDate(s.paidThrough)}`;
  return "";
}

export const StateBadge = ({ state }: { state: string }) => (
  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${STATE_CLASS[state] ?? "bg-sand text-ink/60"}`}>{STATE_LABEL[state] ?? state}</span>
);

export type Creds = { title: string; lines: { label: string; value: string }[]; password: string };

/** One-time credentials. Lives in the caller's component state only; the caller clears it on dismiss or navigation. */
export function CredentialsCard({ creds, onClose }: { creds: Creds; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(creds.password); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <Card className="border-forest bg-forest/5">
      <h2 className="font-display text-xl">{creds.title}</h2>
      <dl className="mt-3 space-y-1 text-sm">
        {creds.lines.map((l) => (
          <div key={l.label} className="flex flex-wrap gap-2"><dt className="w-28 text-ink/50">{l.label}</dt><dd>{l.value}</dd></div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-28 text-ink/50">Temporary password</dt>
          <dd className="font-data text-base tracking-wide select-all">{creds.password}</dd>
          <button type="button" onClick={copy} className={btnGhost}>{copied ? "Copied" : "Copy"}</button>
        </div>
      </dl>
      <p className="mt-3 rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">
        Shown once. It is not stored anywhere and cannot be seen again. Share it securely (not in a group chat). The user must change it at first sign-in.
      </p>
      <button type="button" onClick={onClose} className={`${btnGhost} mt-3`}>I have shared it, dismiss</button>
    </Card>
  );
}
