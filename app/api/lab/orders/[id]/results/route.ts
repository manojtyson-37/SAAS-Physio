import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { LAB_WORK_ROLES, labGate } from "@/lib/lab/gate";
import { saveLabResults } from "@/lib/lab/orders";
import { resultsSchema } from "@/lib/lab/schemas";

// Result entry and corrections: doctors, clinic admin, lab staff. Corrections are audited and flagged in the response.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await labGate(LAB_WORK_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = resultsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const r = await saveLabResults({ tenantId: g.tenantId, userId: g.session.userId, id, results: parsed.data.results });
    return NextResponse.json({ ...r, note: r.amended ? "Reported result corrected. The change is recorded in the audit log" : undefined });
  } catch (e) {
    return toErrorResponse(e);
  }
}
