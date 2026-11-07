import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { isValidDayKey, istDateKey, istDayRange } from "@/lib/hospital/dates";
import { toPaise } from "@/lib/hospital/billing";

/** Day-end summary: what was collected (by method), what was billed, and all outstanding dues. */
export async function GET(req: NextRequest) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "STAFF"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "billing");
  if (off) return off;

  const date = req.nextUrl.searchParams.get("date") ?? istDateKey();
  if (!isValidDayKey(date)) {
    return NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 });
  }
  const { start, end } = istDayRange(date);

  const [byMethod, billed, open] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      where: { date: { gte: start, lt: end }, invoice: { tenantId: g.tenantId, deletedAt: null } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { tenantId: g.tenantId, deletedAt: null, status: { not: "CANCELLED" }, date: { gte: start, lt: end } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.findMany({
      where: { tenantId: g.tenantId, deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } },
      select: { total: true, paidAmount: true },
    }),
  ]);

  const methods = byMethod.map((m) => ({
    method: m.method,
    amount: Number(m._sum.amount ?? 0),
    count: m._count,
  }));
  const outstandingPaise = open.reduce((s, i) => s + (toPaise(Number(i.total)) - toPaise(Number(i.paidAmount))), 0);

  return NextResponse.json({
    date,
    collected: methods.reduce((s, m) => s + toPaise(m.amount), 0) / 100,
    byMethod: methods,
    billed: Number(billed._sum.total ?? 0),
    invoiceCount: billed._count,
    outstanding: outstandingPaise / 100,
    openInvoices: open.length,
  });
}
