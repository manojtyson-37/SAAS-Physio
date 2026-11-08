import type { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/hospital/guard";
import { moduleGate } from "@/lib/modules/guard";
import type { SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; tenantId: string; response: null };
type No = { session: null; tenantId: null; response: NextResponse };

/** Clinic login + module switch check. Pharmacy needs inventory too. `write` limits to admin and front desk. */
export async function stockGate(module: "inventory" | "pharmacy", write: boolean): Promise<Ok | No> {
  const g = await requireTenantSession(write ? ["CLINIC_ADMIN", "STAFF"] : undefined);
  if (!g.session) return g;
  for (const key of module === "pharmacy" ? (["pharmacy", "inventory"] as const) : (["inventory"] as const)) {
    const off = await moduleGate(g.session, key);
    if (off) return { session: null, tenantId: null, response: off };
  }
  return g;
}
