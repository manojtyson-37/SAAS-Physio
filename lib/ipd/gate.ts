import type { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/hospital/guard";
import { moduleGate } from "@/lib/modules/guard";
import type { Role, SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; tenantId: string; response: null };
type No = { session: null; tenantId: null; response: NextResponse };

/**
 * Clinic login + module switch check for IPD and discharge routes.
 * `roles` undefined = any clinic user (reads). Discharge always needs IPD on as well.
 */
export async function ipdGate(module: "ipd" | "discharge", roles?: Role[]): Promise<Ok | No> {
  const g = await requireTenantSession(roles);
  if (!g.session) return g;
  for (const key of module === "discharge" ? (["discharge", "ipd"] as const) : (["ipd"] as const)) {
    const off = await moduleGate(g.session, key);
    if (off) return { session: null, tenantId: null, response: off };
  }
  return g;
}

/** Ward and bed administration. */
export const SETUP_ROLES: Role[] = ["CLINIC_ADMIN"];
/** Admit, transfer, discharge, chart: ward work is done by nurses/front desk (STAFF), doctors and admin. */
export const WARD_ROLES: Role[] = ["CLINIC_ADMIN", "DOCTOR", "STAFF"];
/** Discharge summary content is clinical: doctors and admin only. */
export const SUMMARY_ROLES: Role[] = ["CLINIC_ADMIN", "DOCTOR"];
