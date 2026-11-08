import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/hospital/http";
import { RAD_REPORT_ROLES, radGate } from "@/lib/radiology/gate";
import { saveImagingReport } from "@/lib/radiology/orders";
import { reportSchema } from "@/lib/radiology/schemas";

// Reporting is clinical: DOCTOR + CLINIC_ADMIN only. On a final report this is a correction and is audited.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await radGate(RAD_REPORT_ROLES);
  if (!g.session) return g.response;
  const { id } = await params;
  const parsed = reportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const r = await saveImagingReport({ tenantId: g.tenantId, userId: g.session.userId, id, ...parsed.data });
    return NextResponse.json({ ...r, note: r.amended ? "Report corrected. The previous text is kept in the audit log" : undefined });
  } catch (e) {
    return toErrorResponse(e);
  }
}
