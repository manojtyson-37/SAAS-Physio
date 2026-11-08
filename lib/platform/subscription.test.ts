import { describe, expect, it } from "vitest";
import { addDays, applyAction, bannerText, methodAllowed, subscriptionView, type SubRecord } from "./subscription";

const now = new Date("2026-11-08T10:00:00Z");
const rec = (o: Partial<SubRecord> = {}): SubRecord => ({ status: "TRIAL", trialEndsAt: addDays(now, 10), paidThrough: null, plan: null, trialStartedAt: addDays(now, -4), ...o });

describe("subscription state", () => {
  it("trial: full access with days left, then read-only", () => {
    expect(subscriptionView(rec(), now)).toMatchObject({ state: "TRIAL", access: "FULL", daysLeft: 10 });
    expect(subscriptionView(rec({ trialEndsAt: addDays(now, -1) }), now)).toMatchObject({ state: "TRIAL_EXPIRED", access: "READ_ONLY" });
    expect(subscriptionView(rec({ trialEndsAt: null }), now)).toMatchObject({ state: "TRIAL", access: "FULL", daysLeft: null });
  });
  it("active: unlimited when no end date; grace then read-only after paidThrough", () => {
    expect(subscriptionView(rec({ status: "ACTIVE", trialEndsAt: null }), now).access).toBe("FULL");
    expect(subscriptionView(rec({ status: "ACTIVE", paidThrough: addDays(now, 5) }), now)).toMatchObject({ state: "ACTIVE", daysLeft: 5 });
    expect(subscriptionView(rec({ status: "ACTIVE", paidThrough: addDays(now, -3) }), now)).toMatchObject({ state: "GRACE", access: "FULL" });
    expect(subscriptionView(rec({ status: "ACTIVE", paidThrough: addDays(now, -8) }), now)).toMatchObject({ state: "PAID_EXPIRED", access: "READ_ONLY" });
  });
  it("suspended blocks, cancelled is read-only", () => {
    expect(subscriptionView(rec({ status: "SUSPENDED" }), now).access).toBe("BLOCKED");
    expect(subscriptionView(rec({ status: "CANCELLED" }), now).access).toBe("READ_ONLY");
  });
  it("read-only allows reads only", () => {
    expect(methodAllowed("READ_ONLY", "GET")).toBe(true);
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(methodAllowed("READ_ONLY", m)).toBe(false);
    expect(methodAllowed("BLOCKED", "GET")).toBe(false);
    expect(methodAllowed("FULL", "POST")).toBe(true);
  });
  it("banner text", () => {
    expect(bannerText(subscriptionView(rec(), now))).toBe("Trial: 10 days left.");
    expect(bannerText(subscriptionView(rec({ status: "ACTIVE", trialEndsAt: null }), now))).toBeNull();
    expect(bannerText(subscriptionView(rec({ trialEndsAt: addDays(now, -1) }), now))).toMatch(/ended/);
  });
});

describe("subscription actions", () => {
  it("start trial: default 14 days; onboarding only once; never on a paid plan or suspended clinic", () => {
    const fresh = rec({ status: "ACTIVE", trialStartedAt: null, trialEndsAt: null });
    const r = applyAction(fresh, { action: "start_trial" }, false, now);
    expect(r).toMatchObject({ ok: true, patch: { subscriptionStatus: "TRIAL" } });
    if (r.ok) expect(r.patch.trialEndsAt).toEqual(addDays(now, 14));
    expect(applyAction(rec(), { action: "start_trial" }, false, now)).toMatchObject({ ok: false });
    expect(applyAction(rec(), { action: "start_trial", days: 30 }, true, now)).toMatchObject({ ok: true });
    expect(applyAction(fresh, { action: "start_trial", days: 99 }, true, now)).toMatchObject({ ok: false });
    expect(applyAction(rec({ status: "ACTIVE", paidThrough: addDays(now, 20), trialStartedAt: null }), { action: "start_trial" }, true, now)).toMatchObject({ ok: false });
    expect(applyAction(rec({ status: "SUSPENDED", trialStartedAt: null }), { action: "start_trial" }, true, now)).toMatchObject({ ok: false });
  });
  it("extend trial: bounded for onboarding, only while on trial", () => {
    expect(applyAction(rec(), { action: "extend_trial", days: 7 }, false, now)).toMatchObject({ ok: true });
    expect(applyAction(rec(), { action: "extend_trial", days: 31 }, true, now)).toMatchObject({ ok: false });
    expect(applyAction(rec({ trialStartedAt: addDays(now, -50) }), { action: "extend_trial", days: 30 }, false, now)).toMatchObject({ ok: false });
    expect(applyAction(rec({ trialStartedAt: addDays(now, -50) }), { action: "extend_trial", days: 30 }, true, now)).toMatchObject({ ok: true });
    expect(applyAction(rec({ status: "ACTIVE" }), { action: "extend_trial", days: 7 }, true, now)).toMatchObject({ ok: false });
    const lapsed = applyAction(rec({ trialEndsAt: addDays(now, -5) }), { action: "extend_trial", days: 7 }, true, now);
    if (lapsed.ok) expect(lapsed.patch.trialEndsAt).toEqual(addDays(now, 7));
  });
  it("money and access actions are owner-only", () => {
    for (const a of [{ action: "activate", plan: "STARTER" }, { action: "suspend" }, { action: "cancel" }, { action: "reactivate" }] as const)
      expect(applyAction(rec({ status: "SUSPENDED" }), a, false, now)).toEqual({ ok: false, error: "Only the platform owner can do this" });
    expect(applyAction(rec(), { action: "activate", plan: "STARTER", paidThrough: addDays(now, 30) }, true, now)).toMatchObject({ ok: true, patch: { subscriptionStatus: "ACTIVE", plan: "STARTER" } });
    expect(applyAction(rec(), { action: "activate", plan: "GOLD" }, true, now)).toMatchObject({ ok: false });
    expect(applyAction(rec(), { action: "activate", plan: "STARTER", paidThrough: addDays(now, -1) }, true, now)).toMatchObject({ ok: false });
    expect(applyAction(rec(), { action: "suspend", note: "unpaid" }, true, now)).toMatchObject({ ok: true, patch: { subscriptionStatus: "SUSPENDED" } });
    expect(applyAction(rec({ status: "SUSPENDED" }), { action: "reactivate" }, true, now)).toMatchObject({ ok: true });
    expect(applyAction(rec(), { action: "reactivate" }, true, now)).toMatchObject({ ok: false });
  });
  it("onboarding can set the plan label", () => {
    expect(applyAction(rec(), { action: "set_plan", plan: "HOSPITAL" }, false, now)).toMatchObject({ ok: true, patch: { plan: "HOSPITAL" } });
    expect(applyAction(rec(), { action: "set_plan", plan: "nope" }, false, now)).toMatchObject({ ok: false });
  });
});

import { generateTempPassword } from "./password";
describe("temporary passwords", () => {
  it("are 16+ chars with mixed classes, no ambiguous characters, and differ each time", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const p = generateTempPassword();
      expect(p.length).toBe(16);
      expect(/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)).toBe(true);
      expect(/[0OolI1]/.test(p)).toBe(false);
      seen.add(p);
    }
    expect(seen.size).toBe(50);
    expect(generateTempPassword(20).length).toBe(20);
  });
});
