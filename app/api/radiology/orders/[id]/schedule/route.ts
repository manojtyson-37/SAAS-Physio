import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_WORK_ROLES, radGate } from "@/lib/radiology/gate";
import { scheduleImaging } from "@/lib/radiology/orders";
import { scheduleSchema } from "@/lib/radiology/schemas";

// Scheduling is operational: all clinic roles.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await radGate(RAD_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = scheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json(await scheduleImaging({ tenantId: g.tenantId, userId: g.session.userId, id, scheduledAt: new Date(parsed.data.scheduledAt) }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
