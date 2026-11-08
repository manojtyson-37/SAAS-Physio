/** Treatment plan rules: totals and status transitions. Pure functions. */
import { toPaise } from "@/lib/hospital/billing";

export type PlanStatus = "PROPOSED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ItemStatus = "PLANNED" | "DONE" | "CANCELLED";

export const PLAN_STATUSES: PlanStatus[] = ["PROPOSED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export const PLAN_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  PROPOSED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const canTransition = (from: PlanStatus, to: PlanStatus) => PLAN_TRANSITIONS[from].includes(to);
/** Items can be added/edited/removed only while the plan is open. */
export const planIsOpen = (s: PlanStatus) => s !== "COMPLETED" && s !== "CANCELLED";
/** Procedures can be marked done once the patient accepted the plan. */
export const canMarkDone = (s: PlanStatus) => s === "ACCEPTED" || s === "IN_PROGRESS";

/** Why a plan cannot move to `to`, or null when it can. */
export function transitionBlocker(from: PlanStatus, to: PlanStatus, items: { status: ItemStatus }[]): string | null {
  if (!canTransition(from, to)) return `A ${from.toLowerCase().replace("_", " ")} plan cannot move to ${to.toLowerCase().replace("_", " ")}`;
  if (to === "COMPLETED") {
    if (items.some((i) => i.status === "PLANNED")) return "Mark every planned procedure done or remove it before completing the plan";
    if (!items.some((i) => i.status === "DONE")) return "Complete at least one procedure before completing the plan";
  }
  return null;
}

type Priced = { price: number | string; gstPercent: number | string; status: ItemStatus };

export type PlanTotals = { planned: number; done: number; billable: number; gstDone: number; doneCount: number; plannedCount: number };

/** Totals in paise. `planned` = open items incl. GST; `done` = finished items incl. GST. Cancelled items are ignored. */
export function planTotals(items: Priced[]): PlanTotals {
  const t: PlanTotals = { planned: 0, done: 0, billable: 0, gstDone: 0, doneCount: 0, plannedCount: 0 };
  for (const i of items) {
    if (i.status === "CANCELLED") continue;
    const base = toPaise(Number(i.price));
    const gst = Math.round((base * Math.round(Number(i.gstPercent) * 100)) / 10_000);
    if (i.status === "PLANNED") { t.planned += base + gst; t.plannedCount++; }
    else { t.done += base + gst; t.gstDone += gst; t.doneCount++; }
  }
  t.billable = t.done;
  return t;
}
