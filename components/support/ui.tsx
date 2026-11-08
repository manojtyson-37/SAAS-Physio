"use client";

export const CATEGORY_LABEL: Record<string, string> = {
  QUESTION: "Question",
  ISSUE: "Something is not working",
  BILLING: "Billing",
  FEATURE: "Feature request",
};

const STATUS: Record<string, { text: string; cls: string }> = {
  OPEN: { text: "With ClinicOS", cls: "bg-sand text-ink/70" },
  IN_PROGRESS: { text: "In progress", cls: "bg-forest/10 text-forest" },
  WAITING_CLINIC: { text: "Waiting for you", cls: "bg-clay-light text-clay font-medium" },
  RESOLVED: { text: "Resolved", cls: "bg-forest/10 text-forest" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { text: status, cls: "bg-sand text-ink/60" };
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${s.cls}`}>{s.text}</span>;
}

export const whenIST = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
