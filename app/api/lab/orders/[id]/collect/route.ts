import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { LAB_WORK_ROLES, labGate } from "@/lib/lab/gate";
import { collectLabOrder } from "@/lib/lab/orders";

// Collection is operational: all clinic roles may mark the sample collected.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await labGate(LAB_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  try {
    return NextResponse.json(await collectLabOrder({ tenantId: g.tenantId, userId: g.session.userId, id }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
