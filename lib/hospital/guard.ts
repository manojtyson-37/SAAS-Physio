import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import type { Role, SessionPayload } from "@/lib/auth";

type Ok = { session: SessionPayload; tenantId: string; response: null };
type Denied = { session: null; tenantId: null; response: NextResponse };

/** Like requireSession, but also requires a tenant (SUPER_ADMIN has none and cannot run clinical workflows). */
export async function requireTenantSession(roles?: Role[]): Promise<Ok | Denied> {
  const { session, response } = await requireSession(roles);
  if (!session) return { session: null, tenantId: null, response: response! };
  if (!session.tenantId) {
    return {
      session: null,
      tenantId: null,
      response: NextResponse.json({ error: "A clinic account is required" }, { status: 403 }),
    };
  }
  return { session, tenantId: session.tenantId, response: null };
}
