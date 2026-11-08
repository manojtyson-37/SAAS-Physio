import type { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/hospital/guard";
import { moduleGate } from "@/lib/modules/guard";
import type { Role, SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; tenantId: string; response: null };
type No = { session: null; tenantId: null; response: NextResponse };

/** Operational writes (study type catalogue): front desk and clinic admin. */
export const RAD_CATALOGUE_ROLES: Role[] = ["CLINIC_ADMIN", "STAFF"];
/** Ordering, scheduling and marking studies performed: every clinic role. */
export const RAD_WORK_ROLES: Role[] = ["CLINIC_ADMIN", "DOCTOR", "STAFF"];

/** Clinic login (optionally limited to `roles`) plus the radiology module switch. */
export async function radGate(roles?: Role[]): Promise<Ok | No> {
  const g = await requireTenantSession(roles);
  if (!g.session) return g;
  const off = await moduleGate(g.session, "radiology");
  if (off) return { session: null, tenantId: null, response: off };
  return g;
}

/** Writing or correcting the radiology report is clinical: doctors and clinic admin only. */
export const RAD_REPORT_ROLES: Role[] = ["CLINIC_ADMIN", "DOCTOR"];
