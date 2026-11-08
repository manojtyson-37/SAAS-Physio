import { SessionPayload } from "@/lib/auth";

/** Returns the Prisma where-clause fragment that scopes a query to the user's own clinic. */
export function tenantScope(session: SessionPayload) {
  // Only clinic users have a scope. The platform roles (owner and onboarding) never read clinic data; requireSession already
  // refuses them on clinic routes, this is the second lock.
  if (!session.tenantId) throw new Error("No clinic scope for this role");
  return { tenantId: session.tenantId };
}
