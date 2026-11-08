import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { LAB_WORK_ROLES, labGate } from "@/lib/lab/gate";
import { cancelLabOrder } from "@/lib/lab/orders";
import { cancelSchema } from "@/lib/lab/schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await labGate(LAB_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = cancelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json(await cancelLabOrder({ tenantId: g.tenantId, userId: g.session.userId, id, reason: parsed.data.reason }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
