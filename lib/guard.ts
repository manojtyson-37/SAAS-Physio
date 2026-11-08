import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession, Role, sessionPredatesPasswordChange } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { methodAllowed, subscriptionView } from "@/lib/platform/subscription";
import { sessionModules } from "@/lib/modules/sessionModules";

/** Platform staff have no clinic. The onboarding role is deny-by-default: a route must list ONBOARDING to admit it. */
export const PLATFORM_ROLES: Role[] = ["SUPER_ADMIN", "ONBOARDING"];

/**
 * Every API route starts here. Beyond the cookie and the role check it re-reads the user and the clinic from the
 * database on each call, so that deactivating a user, suspending a clinic or ending a trial takes effect at once
 * (the signed cookie alone would stay valid for 7 days).
 *  - inactive/deleted user or clinic        -> 401 / 403
 *  - temporary password not yet changed      -> 403 password_change_required
 *  - suspended clinic                        -> 403 subscription_suspended
 *  - expired/cancelled clinic, write request -> 402 subscription_expired (reads still work)
 */
export async function requireSession(allowedRoles?: Role[], opts: { allowWhenReadOnly?: boolean } = {}) {
  const session = await getSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  // Platform roles have no clinic. Both are deny-by-default: a route must name the role to admit it, so neither can reach
  // a clinic route that merely calls requireSession() (that is what keeps clinic data out of the owner's and onboarding's hands).
  if ((session.role === "ONBOARDING" || session.role === "SUPER_ADMIN") && !allowedRoles?.includes(session.role)) {
    return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      isActive: true, deletedAt: true, mustChangePassword: true, passwordChangedAt: true, role: true, tenantId: true,
      tenant: { select: { deletedAt: true, subscriptionStatus: true, trialEndsAt: true, paidThrough: true, enabledModules: true } },
    },
  });
  if (!user || !user.isActive || user.deletedAt || user.role !== session.role || user.tenantId !== session.tenantId) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  // A password change (or reset) ends every session issued before it, including a stolen one.
  if (sessionPredatesPasswordChange(session, user.passwordChangedAt)) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.mustChangePassword) {
    return { session: null, response: NextResponse.json({ error: "password_change_required", message: "Choose a new password to continue" }, { status: 403 }) };
  }
  if (session.tenantId) {
    if (!user.tenant || user.tenant.deletedAt) {
      return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    const view = subscriptionView({ status: user.tenant.subscriptionStatus, trialEndsAt: user.tenant.trialEndsAt, paidThrough: user.tenant.paidThrough });
    // Middleware stamps the real HTTP method on every API request; if it is ever missing, treat the call as a write.
    const method = ((await headers()).get("x-cos-method") ?? "POST").toUpperCase();
    if (view.access === "BLOCKED") {
      return { session: null, response: NextResponse.json({ error: "subscription_suspended", message: "This clinic's account is suspended. Contact ClinicOS support." }, { status: 403 }) };
    }
    // `allowWhenReadOnly` is for routes a clinic must still reach when its subscription has ended (contacting support).
    if (!(opts.allowWhenReadOnly && view.access === "READ_ONLY") && !methodAllowed(view.access, method)) {
      return { session: null, response: NextResponse.json({ error: "subscription_expired", message: "Your subscription has ended, so records are read-only. Contact ClinicOS to renew." }, { status: 402 }) };
    }
  }
  if (user.tenant) sessionModules.set(session, user.tenant.enabledModules);
  return { session, response: null };
}
