import type { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/hospital/guard";
import { moduleGate } from "@/lib/modules/guard";
import type { Role, SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; tenantId: string; response: null };
type No = { session: null; tenantId: null; response: NextResponse };

/** Clinic login + exercise_plans module check. `roles` limits who may call (omit for read access to any clinic user). */
export async function exerciseGate(roles?: Role[]): Promise<Ok | No> {
  const g = await requireTenantSession(roles);
  if (!g.session) return g;
  const off = await moduleGate(g.session, "exercise_plans");
  if (off) return { session: null, tenantId: null, response: off };
  return g;
}

/** Prescribing is clinical: doctors and clinic admins. */
export const PRESCRIBERS: Role[] = ["DOCTOR", "CLINIC_ADMIN"];
/** Logging a patient's pain/adherence is operational: front desk may do it too. */
export const PROGRESS_LOGGERS: Role[] = ["DOCTOR", "CLINIC_ADMIN", "STAFF"];
