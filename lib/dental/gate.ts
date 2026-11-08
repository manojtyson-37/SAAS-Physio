import type { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/hospital/guard";
import { moduleGate } from "@/lib/modules/guard";
import type { Role, SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; tenantId: string; response: null };
type No = { session: null; tenantId: null; response: NextResponse };

/** Clinic login + dental_chart module check. `roles` limits who may call (omit for read access to any clinic user). */
export async function dentalGate(roles?: Role[]): Promise<Ok | No> {
  const g = await requireTenantSession(roles);
  if (!g.session) return g;
  const off = await moduleGate(g.session, "dental_chart");
  if (off) return { session: null, tenantId: null, response: off };
  return g;
}

/** Clinical content: doctors and clinic admins write. */
export const CLINICAL_WRITERS: Role[] = ["DOCTOR", "CLINIC_ADMIN"];
