import type { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import type { SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; owner: boolean; response: null };
type No = { session: null; owner: false; response: NextResponse };

/**
 * Platform staff only. `ownerOnly` limits a route to the platform owner (SUPER_ADMIN); otherwise the onboarding team
 * may use it too. Platform staff have no clinic and never receive clinic patient data from these routes.
 */
export async function platformGate(ownerOnly = false): Promise<Ok | No> {
  const { session, response } = await requireSession(ownerOnly ? ["SUPER_ADMIN"] : ["SUPER_ADMIN", "ONBOARDING"]);
  if (!session) return { session: null, owner: false, response: response! };
  return { session, owner: session.role === "SUPER_ADMIN", response: null };
}
