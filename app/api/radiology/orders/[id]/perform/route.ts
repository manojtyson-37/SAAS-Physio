import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_WORK_ROLES, radGate } from "@/lib/radiology/gate";
import { performImaging } from "@/lib/radiology/orders";

// Marking the study performed is operational: all clinic roles (radiographer = STAFF).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await radGate(RAD_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  try {
    return NextResponse.json(await performImaging({ tenantId: g.tenantId, userId: g.session.userId, id }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
