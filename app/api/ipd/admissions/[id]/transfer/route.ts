import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, WARD_ROLES } from "@/lib/ipd/gate";
import { transfer } from "@/lib/ipd/service";
import { transferSchema } from "@/lib/ipd/schemas";

// Ward staff, doctors and admin.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await ipdGate("ipd", WARD_ROLES);
  if (!g.session) return g.response;
  const { id } = await ctx.params;
  const parsed = transferSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json(await transfer({ tenantId: g.tenantId, userId: g.session.userId, admissionId: id, toBedId: parsed.data.toBedId }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
