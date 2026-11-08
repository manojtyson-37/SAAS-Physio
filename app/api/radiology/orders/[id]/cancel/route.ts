import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_WORK_ROLES, radGate } from "@/lib/radiology/gate";
import { cancelImaging } from "@/lib/radiology/orders";
import { cancelSchema } from "@/lib/radiology/schemas";

// Cancel before the report is final; an unpaid invoice is cancelled with it, a paid one blocks (409).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await radGate(RAD_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = cancelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json(await cancelImaging({ tenantId: g.tenantId, userId: g.session.userId, id, reason: parsed.data.reason }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
