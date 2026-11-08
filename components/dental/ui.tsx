"use client";

import { useEffect, useState } from "react";
import { useHasModule } from "@/components/ClinicContext";

export { api, btnGhost, btnPrimary, input, inr, Notice } from "@/components/pharmacy/ui";
export type { Msg } from "@/components/pharmacy/ui";

/** Paise to rupee text. */
export const paise = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export const PLAN_LABEL: Record<string, string> = { PROPOSED: "Proposed", ACCEPTED: "Accepted", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const PLAN_CLASS: Record<string, string> = {
  PROPOSED: "bg-sand text-ink/70", ACCEPTED: "bg-forest/10 text-forest", IN_PROGRESS: "bg-clay-light text-clay", COMPLETED: "bg-forest text-cream", CANCELLED: "bg-ink/10 text-ink/50 line-through",
};
export const PlanBadge = ({ status }: { status: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs ${PLAN_CLASS[status] ?? "bg-sand"}`}>{PLAN_LABEL[status] ?? status}</span>
);

/** Current user's role (from /api/auth/me); empty string until loaded. */
export function useRole(): string {
  const [role, setRole] = useState("");
  useEffect(() => {
    let cancel = false;
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (!cancel) setRole(d.user?.role ?? ""); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  return role;
}
export const useCanWriteClinical = () => ["DOCTOR", "CLINIC_ADMIN"].includes(useRole());
export const useBillingOn = () => useHasModule("billing");
