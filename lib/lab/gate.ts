import type { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/hospital/guard";
import { moduleGate } from "@/lib/modules/guard";
import type { Role, SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; tenantId: string; response: null };
type No = { session: null; tenantId: null; response: NextResponse };

/** Operational writes (catalogue admin): front desk and clinic admin. */
export const LAB_CATALOGUE_ROLES: Role[] = ["CLINIC_ADMIN", "STAFF"];
/** Ordering, sample collection and result entry: every clinic role. */
export const LAB_WORK_ROLES: Role[] = ["CLINIC_ADMIN", "DOCTOR", "STAFF"];

/** Clinic login (optionally limited to `roles`) plus the lab module switch. */
export async function labGate(roles?: Role[]): Promise<Ok | No> {
  const g = await requireTenantSession(roles);
  if (!g.session) return g;
  const off = await moduleGate(g.session, "lab");
  if (off) return { session: null, tenantId: null, response: off };
  return g;
}
