import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { getEnabledModules } from "@/lib/modules/guard";
import { dispense } from "@/lib/pharmacy/dispense";
import { stockGate } from "@/lib/pharmacy/gate";
import { dispenseSchema } from "@/lib/pharmacy/schemas";

export async function POST(req: NextRequest) {
  const g = await stockGate("pharmacy", true);
  if (!g.session) return g.response;
  const parsed = dispenseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const billingOn = (await getEnabledModules(g.session)).has("billing");
    const result = await dispense({ ...parsed.data, tenantId: g.tenantId, userId: g.session.userId, billingOn });
    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
