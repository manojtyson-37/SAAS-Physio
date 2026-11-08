import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { voidDispensation } from "@/lib/pharmacy/dispense";
import { stockGate } from "@/lib/pharmacy/gate";
import { voidSchema } from "@/lib/pharmacy/schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await stockGate("pharmacy", true);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = voidSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json(await voidDispensation({ tenantId: g.tenantId, userId: g.session.userId, id, reason: parsed.data.reason }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
