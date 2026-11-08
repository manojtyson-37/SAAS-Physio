import { SessionPayload } from "@/lib/auth";

/** Returns a Prisma where-clause fragment scoping by tenant, or {} for Super Admin (platform-wide). */
export function tenantScope(session: SessionPayload) {
  // The onboarding team must never read clinic data; requireSession already refuses it, this is the second lock.
  if (session.role === "ONBOARDING" || !session.tenantId && session.role !== "SUPER_ADMIN") throw new Error("No clinic scope for this role");
  if (session.role === "SUPER_ADMIN") return {};
  return { tenantId: session.tenantId! };
}
