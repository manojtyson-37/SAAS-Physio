"use client";

import { useEffect, useState } from "react";

export { api, btnGhost, btnPrimary, input, Notice } from "@/components/pharmacy/ui";
export type { Msg } from "@/components/pharmacy/ui";

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const STATUS_CLASS: Record<string, string> = { ACTIVE: "bg-forest/10 text-forest", COMPLETED: "bg-forest text-cream", CANCELLED: "bg-ink/10 text-ink/50 line-through" };
export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_CLASS[status] ?? "bg-sand"}`}>{STATUS_LABEL[status] ?? status}</span>
);

export type Template = { id: string; name: string; category: string; description: string | null; sets: number | null; reps: number | null; holdSeconds: number | null; instructions: string | null; isActive: boolean };

export function useRole(): string {
  const [role, setRole] = useState("");
  useEffect(() => {
    let cancel = false;
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (!cancel) setRole(d.user?.role ?? ""); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  return role;
}
export const useCanPrescribe = () => ["DOCTOR", "CLINIC_ADMIN"].includes(useRole());
export const useCanLog = () => ["DOCTOR", "CLINIC_ADMIN", "STAFF"].includes(useRole());
