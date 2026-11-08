/**
 * Subscription rules (pure, no database). A clinic's access follows from its stored status and dates, computed on the
 * fly, so nothing needs a nightly job to "expire" a trial.
 *
 *  TRIAL            full access until trialEndsAt, then TRIAL_EXPIRED (read-only: data stays safe and visible)
 *  ACTIVE           full access; if paidThrough is set and passes, GRACE_DAYS of full access, then PAID_EXPIRED (read-only)
 *  SUSPENDED        blocked (the platform team's lever for non-payment or abuse)
 *  CANCELLED        read-only (the clinic can still see and print its records)
 */
export type SubStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
export type SubState = "TRIAL" | "TRIAL_EXPIRED" | "ACTIVE" | "GRACE" | "PAID_EXPIRED" | "SUSPENDED" | "CANCELLED";
export type Access = "FULL" | "READ_ONLY" | "BLOCKED";

export const GRACE_DAYS = 7;
export const DEFAULT_TRIAL_DAYS = 14;
export const MAX_TRIAL_DAYS = 60; // onboarding team cap, counted from the trial start
export const MAX_EXTEND_DAYS = 30;
export const PLANS = ["STARTER", "PROFESSIONAL", "HOSPITAL"] as const;
export type Plan = (typeof PLANS)[number];
export const isPlan = (p: string): p is Plan => (PLANS as readonly string[]).includes(p);

const DAY = 86_400_000;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const daysBetween = (from: Date, to: Date) => Math.ceil((to.getTime() - from.getTime()) / DAY);

export type SubInput = { status: SubStatus; trialEndsAt: Date | null; paidThrough: Date | null };
export type SubView = { state: SubState; access: Access; daysLeft: number | null; endsAt: Date | null };

export function subscriptionView(s: SubInput, now: Date = new Date()): SubView {
  switch (s.status) {
    case "SUSPENDED": return { state: "SUSPENDED", access: "BLOCKED", daysLeft: null, endsAt: null };
    case "CANCELLED": return { state: "CANCELLED", access: "READ_ONLY", daysLeft: null, endsAt: null };
    case "TRIAL": {
      if (!s.trialEndsAt) return { state: "TRIAL", access: "FULL", daysLeft: null, endsAt: null };
      return now <= s.trialEndsAt
        ? { state: "TRIAL", access: "FULL", daysLeft: Math.max(0, daysBetween(now, s.trialEndsAt)), endsAt: s.trialEndsAt }
        : { state: "TRIAL_EXPIRED", access: "READ_ONLY", daysLeft: 0, endsAt: s.trialEndsAt };
    }
    case "ACTIVE": {
      if (!s.paidThrough) return { state: "ACTIVE", access: "FULL", daysLeft: null, endsAt: null };
      if (now <= s.paidThrough) return { state: "ACTIVE", access: "FULL", daysLeft: daysBetween(now, s.paidThrough), endsAt: s.paidThrough };
      if (now <= addDays(s.paidThrough, GRACE_DAYS)) return { state: "GRACE", access: "FULL", daysLeft: Math.max(0, daysBetween(now, addDays(s.paidThrough, GRACE_DAYS))), endsAt: s.paidThrough };
      return { state: "PAID_EXPIRED", access: "READ_ONLY", daysLeft: 0, endsAt: s.paidThrough };
    }
  }
}

/** A request is allowed when access is FULL, or READ_ONLY and the method only reads. */
export const methodAllowed = (access: Access, method: string) =>
  access === "FULL" || (access === "READ_ONLY" && (method === "GET" || method === "HEAD" || method === "OPTIONS"));

/** One-line text for the banner shown to clinic users; null when there is nothing to say. */
export function bannerText(v: SubView): string | null {
  switch (v.state) {
    case "TRIAL": return v.daysLeft === null ? null : v.daysLeft <= 0 ? "Your trial ends today." : `Trial: ${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left.`;
    case "TRIAL_EXPIRED": return "Your trial has ended. Your records are safe and read-only until the plan is activated.";
    case "GRACE": return `Your subscription has lapsed. Full access continues for ${v.daysLeft} more day${v.daysLeft === 1 ? "" : "s"}.`;
    case "PAID_EXPIRED": return "Your subscription has expired. Your records are read-only until it is renewed.";
    case "CANCELLED": return "This subscription is cancelled. Your records are read-only.";
    default: return null;
  }
}

export type SubAction =
  | { action: "start_trial"; days?: number }
  | { action: "extend_trial"; days: number }
  | { action: "set_plan"; plan: string }
  | { action: "activate"; plan: string; paidThrough?: Date | null }
  | { action: "suspend" | "reactivate" | "cancel"; note?: string };

export type SubRecord = SubInput & { plan: string | null; trialStartedAt: Date | null };
export type SubPatch = { subscriptionStatus?: SubStatus; plan?: string | null; trialStartedAt?: Date; trialEndsAt?: Date | null; paidThrough?: Date | null; subscriptionNote?: string | null };
export type SubResult = { ok: true; patch: SubPatch } | { ok: false; error: string };

/**
 * Applies one subscription action. `owner` is the platform owner (SUPER_ADMIN); the onboarding team may start and
 * extend trials within limits and set the plan label, but money and access decisions (activate, suspend, cancel,
 * reactivate) are the owner's.
 */
export function applyAction(cur: SubRecord, a: SubAction, owner: boolean, now: Date = new Date()): SubResult {
  const ownerOnly = (): SubResult => ({ ok: false, error: "Only the platform owner can do this" });
  switch (a.action) {
    case "start_trial": {
      const days = a.days ?? DEFAULT_TRIAL_DAYS;
      if (!Number.isInteger(days) || days < 1 || days > MAX_TRIAL_DAYS) return { ok: false, error: `A trial is 1 to ${MAX_TRIAL_DAYS} days` };
      if (!owner && cur.trialStartedAt) return { ok: false, error: "This clinic has already had a trial. Ask the platform owner" };
      if (cur.status === "SUSPENDED") return { ok: false, error: "This clinic is suspended" };
      if (cur.status === "ACTIVE" && cur.paidThrough && cur.paidThrough > now) return { ok: false, error: "This clinic is on a paid plan" };
      return { ok: true, patch: { subscriptionStatus: "TRIAL", trialStartedAt: now, trialEndsAt: addDays(now, days) } };
    }
    case "extend_trial": {
      if (!Number.isInteger(a.days) || a.days < 1 || a.days > MAX_EXTEND_DAYS) return { ok: false, error: `Extend by 1 to ${MAX_EXTEND_DAYS} days` };
      if (cur.status !== "TRIAL") return { ok: false, error: "Only a clinic on trial can be extended" };
      const base = cur.trialEndsAt && cur.trialEndsAt > now ? cur.trialEndsAt : now;
      const end = addDays(base, a.days);
      const start = cur.trialStartedAt ?? now;
      if (!owner && daysBetween(start, end) > MAX_TRIAL_DAYS) return { ok: false, error: `A trial cannot run longer than ${MAX_TRIAL_DAYS} days in total` };
      return { ok: true, patch: { trialEndsAt: end, ...(cur.trialStartedAt ? {} : { trialStartedAt: now }) } };
    }
    case "set_plan":
      if (!isPlan(a.plan)) return { ok: false, error: "Unknown plan" };
      return { ok: true, patch: { plan: a.plan } };
    case "activate": {
      if (!owner) return ownerOnly();
      if (!isPlan(a.plan)) return { ok: false, error: "Choose a plan to activate" };
      if (a.paidThrough && a.paidThrough <= now) return { ok: false, error: "Paid-through date must be in the future" };
      return { ok: true, patch: { subscriptionStatus: "ACTIVE", plan: a.plan, paidThrough: a.paidThrough ?? null } };
    }
    case "suspend":
      if (!owner) return ownerOnly();
      if (cur.status === "SUSPENDED") return { ok: false, error: "Already suspended" };
      return { ok: true, patch: { subscriptionStatus: "SUSPENDED", subscriptionNote: a.note?.slice(0, 300) || null } };
    case "cancel":
      if (!owner) return ownerOnly();
      if (cur.status === "CANCELLED") return { ok: false, error: "Already cancelled" };
      return { ok: true, patch: { subscriptionStatus: "CANCELLED", subscriptionNote: a.note?.slice(0, 300) || null } };
    case "reactivate":
      if (!owner) return ownerOnly();
      if (cur.status !== "SUSPENDED" && cur.status !== "CANCELLED") return { ok: false, error: "Only a suspended or cancelled clinic can be reactivated" };
      return { ok: true, patch: { subscriptionStatus: cur.trialEndsAt && !cur.paidThrough && !cur.plan ? "TRIAL" : "ACTIVE", subscriptionNote: null } };
  }
}
