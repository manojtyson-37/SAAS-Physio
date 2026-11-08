import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { istDayRange } from "@/lib/hospital/dates";
import { toErrorResponse } from "@/lib/hospital/http";
import { getEnabledModules } from "@/lib/modules/guard";
import { RAD_WORK_ROLES, radGate } from "@/lib/radiology/gate";
import { createImagingOrder } from "@/lib/radiology/orders";
import { createImagingOrderSchema, listQuerySchema } from "@/lib/radiology/schemas";
import { invoiceMap } from "@/lib/radiology/view";

export async function GET(req: NextRequest) {
  const g = await radGate();
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const parsed = listQuerySchema.safeParse({ status: sp.get("status") || undefined, modality: sp.get("modality") || undefined, from: sp.get("from") || undefined, to: sp.get("to") || undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid filter" }, { status: 400 });
  const { status, modality, from, to } = parsed.data;
  const where: Prisma.ImagingOrderWhereInput = { tenantId: g.tenantId, deletedAt: null };
  if (status) where.status = status;
  if (modality) where.modality = modality;
  const patientId = sp.get("patientId");
  if (patientId) where.patientId = patientId;
  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { orderNo: { contains: q, mode: "insensitive" } },
      { studyName: { contains: q, mode: "insensitive" } },
      { patient: { name: { contains: q, mode: "insensitive" } } },
      { patient: { uhid: { contains: q, mode: "insensitive" } } },
      { patient: { phone: { contains: q } } },
    ];
  }
  if (from || to) where.createdAt = { ...(from ? { gte: istDayRange(from).start } : {}), ...(to ? { lt: istDayRange(to).end } : {}) };
  const rows = await prisma.imagingOrder.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    include: { patient: { select: { id: true, name: true, uhid: true } } },
  });
  const inv = await invoiceMap(g.tenantId, rows.map((r) => r.invoiceId));
  return NextResponse.json({
    orders: rows.map((o) => ({
      id: o.id, orderNo: o.orderNo, status: o.status, studyName: o.studyName, modality: o.modality, bodyPart: o.bodyPart,
      createdAt: o.createdAt, scheduledAt: o.scheduledAt, reportedAt: o.reportedAt, patient: o.patient,
      invoice: o.invoiceId ? inv.get(o.invoiceId) ?? null : null,
    })),
  });
}

// Order: doctors, clinic admin and front desk.
export async function POST(req: NextRequest) {
  const g = await radGate(RAD_WORK_ROLES);
  if (!g.session) return g.response;
  const parsed = createImagingOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const billingOn = (await getEnabledModules(g.session)).has("billing");
    const r = await createImagingOrder({ ...parsed.data, bill: parsed.data.bill ?? false, tenantId: g.tenantId, userId: g.session.userId, billingOn });
    return NextResponse.json(r, { status: r.replay ? 200 : 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
