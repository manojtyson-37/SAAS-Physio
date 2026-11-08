import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { istDayRange } from "@/lib/hospital/dates";
import { toErrorResponse } from "@/lib/hospital/http";
import { getEnabledModules } from "@/lib/modules/guard";
import { LAB_WORK_ROLES, labGate } from "@/lib/lab/gate";
import { createLabOrder } from "@/lib/lab/orders";
import { createLabOrderSchema, listQuerySchema } from "@/lib/lab/schemas";
import { invoiceMap } from "@/lib/lab/view";
import { orderTotals } from "@/lib/lab/logic";

export async function GET(req: NextRequest) {
  const g = await labGate();
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const parsed = listQuerySchema.safeParse({ status: sp.get("status") || undefined, from: sp.get("from") || undefined, to: sp.get("to") || undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid filter" }, { status: 400 });
  const { status, from, to } = parsed.data;
  const where: Prisma.LabOrderWhereInput = { tenantId: g.tenantId, deletedAt: null };
  if (status) where.status = status;
  const patientId = sp.get("patientId");
  if (patientId) where.patientId = patientId;
  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { orderNo: { contains: q, mode: "insensitive" } },
      { patient: { name: { contains: q, mode: "insensitive" } } },
      { patient: { uhid: { contains: q, mode: "insensitive" } } },
      { patient: { phone: { contains: q } } },
    ];
  }
  if (from || to) where.createdAt = { ...(from ? { gte: istDayRange(from).start } : {}), ...(to ? { lt: istDayRange(to).end } : {}) };
  const rows = await prisma.labOrder.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    include: { patient: { select: { id: true, name: true, uhid: true } }, items: { select: { testName: true, resultValue: true, flag: true, price: true, gstPercent: true } } },
  });
  const inv = await invoiceMap(g.tenantId, rows.map((r) => r.invoiceId));
  return NextResponse.json({
    orders: rows.map((o) => ({
      id: o.id, orderNo: o.orderNo, status: o.status, createdAt: o.createdAt, patient: o.patient,
      tests: o.items.length, resulted: o.items.filter((i) => !!i.resultValue).length,
      abnormal: o.items.filter((i) => i.flag && i.flag !== "NORMAL").length,
      names: o.items.slice(0, 3).map((i) => i.testName), total: orderTotals(o.items.map((i) => ({ price: Number(i.price), gstPercent: Number(i.gstPercent) }))).totalPaise / 100,
      invoice: o.invoiceId ? inv.get(o.invoiceId) ?? null : null,
    })),
  });
}

// Order: doctors, clinic admin and front desk.
export async function POST(req: NextRequest) {
  const g = await labGate(LAB_WORK_ROLES);
  if (!g.session) return g.response;
  const parsed = createLabOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const billingOn = (await getEnabledModules(g.session)).has("billing");
    const r = await createLabOrder({ ...parsed.data, bill: parsed.data.bill ?? false, tenantId: g.tenantId, userId: g.session.userId, billingOn });
    return NextResponse.json(r, { status: r.replay ? 200 : 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
