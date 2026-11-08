import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { getEnabledModules } from "@/lib/modules/guard";
import { istDateKey, istDayRange } from "@/lib/hospital/dates";
import { toPaise } from "@/lib/hospital/billing";
import { stockAlerts } from "@/lib/pharmacy/view";

const minutes = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

/**
 * Module-aware dashboard: a section is only computed (and returned) when the clinic has that module on,
 * and "today" is the India calendar day, not the server's timezone.
 */
export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;

  const scope = tenantScope(session);
  const modules = await getEnabledModules(session);
  const on = (k: Parameters<typeof modules.has>[0]) => modules.has(k);

  const now = new Date();
  const { start: today0, end: today1 } = istDayRange(istDateKey(now));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [patientsCount, newPatientsToday, doctorsCount, staffCount, doctors] = await Promise.all([
    prisma.patient.count({ where: { ...scope, deletedAt: null } }),
    prisma.patient.count({ where: { ...scope, deletedAt: null, createdAt: { gte: today0, lt: today1 } } }),
    prisma.user.count({ where: { ...scope, role: "DOCTOR", isActive: true, deletedAt: null } }),
    prisma.user.count({ where: { ...scope, role: "STAFF", isActive: true, deletedAt: null } }),
    prisma.user.findMany({
      where: { ...scope, role: "DOCTOR", deletedAt: null },
      select: {
        id: true,
        name: true,
        specialty: true,
        appointments: modules.has("appointments") ? { select: { patientId: true } } : false,
        doctorVisits: modules.has("opd") ? { select: { patientId: true } } : false,
      },
    }),
  ]);

  const out: Record<string, unknown> = {
    modules: [...modules],
    patientsCount,
    newPatientsToday,
    doctorsCount,
    staffCount,
  };

  // ---- Billing
  const invoicesByPatient = new Map<string, number>();
  if (on("billing")) {
    const [todayPayments, openInvoices, billedToday, recentPayments, invoices] = await Promise.all([
      prisma.payment.findMany({
        where: { date: { gte: today0, lt: today1 }, invoice: { ...scope, deletedAt: null } },
        select: { method: true, amount: true },
      }),
      prisma.invoice.findMany({
        where: { ...scope, deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } },
        select: { total: true, paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { ...scope, deletedAt: null, status: { not: "CANCELLED" }, date: { gte: today0, lt: today1 } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: { date: { gte: thirtyDaysAgo }, invoice: { ...scope, deletedAt: null } },
        select: { amount: true, date: true },
      }),
      prisma.invoice.findMany({
        where: { ...scope, deletedAt: null, status: { not: "CANCELLED" } },
        select: { patientId: true, total: true },
      }),
    ]);

    const byMethod: Record<string, number> = {};
    for (const p of todayPayments) byMethod[p.method] = (byMethod[p.method] ?? 0) + toPaise(Number(p.amount));
    const trend: Record<string, number> = {};
    for (const p of recentPayments) {
      const key = istDateKey(p.date);
      trend[key] = (trend[key] ?? 0) + toPaise(Number(p.amount));
    }
    for (const i of invoices) {
      invoicesByPatient.set(i.patientId, (invoicesByPatient.get(i.patientId) ?? 0) + toPaise(Number(i.total)));
    }

    out.billing = {
      collectedToday: todayPayments.reduce((s, p) => s + toPaise(Number(p.amount)), 0) / 100,
      collectedByMethod: Object.entries(byMethod).map(([method, paise]) => ({ method, amount: paise / 100 })),
      billedToday: Number(billedToday._sum.total ?? 0),
      invoicesToday: billedToday._count,
      outstanding:
        openInvoices.reduce((s, i) => s + (toPaise(Number(i.total)) - toPaise(Number(i.paidAmount))), 0) / 100,
      openInvoices: openInvoices.length,
      trend: Object.entries(trend)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, paise]) => ({ date, revenue: paise / 100 })),
    };
  }

  // ---- OPD
  if (on("opd")) {
    const visits = await prisma.visit.findMany({
      where: { ...scope, deletedAt: null, tokenDate: istDateKey(now) },
      select: {
        tokenNumber: true,
        status: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        patient: { select: { name: true } },
        doctor: { select: { name: true } },
      },
      orderBy: { tokenNumber: "asc" },
    });
    const waiting = visits.filter((v) => v.status === "WAITING");
    out.opd = {
      total: visits.length,
      waiting: waiting.length,
      inConsult: visits.filter((v) => v.status === "IN_CONSULT").length,
      completed: visits.filter((v) => v.status === "COMPLETED").length,
      avgWaitMin: avg(visits.filter((v) => v.startedAt).map((v) => minutes(v.createdAt, v.startedAt!))),
      avgConsultMin: avg(visits.filter((v) => v.startedAt && v.endedAt).map((v) => minutes(v.startedAt!, v.endedAt!))),
      queue: waiting.slice(0, 5).map((v) => ({
        token: v.tokenNumber,
        patient: v.patient.name,
        doctor: v.doctor.name,
        waitingMin: minutes(v.createdAt, now),
      })),
    };
  }

  // ---- Appointments
  if (on("appointments")) {
    const [today, upcoming] = await Promise.all([
      prisma.appointment.count({ where: { ...scope, deletedAt: null, datetime: { gte: today0, lt: today1 } } }),
      prisma.appointment.count({ where: { ...scope, deletedAt: null, datetime: { gt: now }, status: "SCHEDULED" } }),
    ]);
    out.appointments = { today, upcoming };
  }

  // ---- Packages / plans
  if (on("packages")) {
    const active = await prisma.package.findMany({
      where: { ...scope, deletedAt: null, status: "ACTIVE" },
      select: { totalSessions: true, usedSessions: true },
    });
    out.packages = {
      active: active.length,
      runningLow: active.filter((p) => p.totalSessions - p.usedSessions <= 2).length,
    };
  }

  // ---- Marketing
  if (on("marketing")) {
    const leads = await prisma.patient.findMany({ where: { ...scope, deletedAt: null }, select: { leadSource: true } });
    const counts: Record<string, number> = {};
    for (const p of leads) counts[p.leadSource ?? "DIRECT"] = (counts[p.leadSource ?? "DIRECT"] ?? 0) + 1;
    out.leadCounts = counts;
  }

  // ---- Doctors: patients seen through visits and/or appointments; revenue only when billing is on
  out.doctors = doctors
    .map((d) => {
      const ids = new Set([...(d.appointments || []), ...(d.doctorVisits || [])].map((x) => x.patientId));
      const revenuePaise = [...ids].reduce((s, pid) => s + (invoicesByPatient.get(pid) ?? 0), 0);
      return {
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        patients: ids.size,
        revenue: on("billing") ? revenuePaise / 100 : null,
      };
    })
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0) || b.patients - a.patients);

  // ---- Branch revenue only makes sense with billing and more than one branch
  if (on("billing")) {
    const branches = await prisma.branch.findMany({
      where: { ...scope, deletedAt: null },
      select: {
        name: true,
        patients: {
          select: {
            invoices: { where: { status: { not: "CANCELLED" }, deletedAt: null }, select: { total: true } },
          },
        },
      },
    });
    if (branches.length > 1) {
      out.revenueByBranch = branches.map((b) => ({
        name: b.name,
        revenue: b.patients.reduce((s, p) => s + p.invoices.reduce((si, i) => si + Number(i.total), 0), 0),
      }));
    }
  }

  if (on("inventory") && scope.tenantId) {
    out.stock = await stockAlerts(scope.tenantId, istDateKey(now));
  }
  if (on("pharmacy") && scope.tenantId) {
    const [pendingRx, today] = await Promise.all([
      prisma.prescription.count({
        where: {
          tenantId: scope.tenantId, createdAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) }, items: { some: {} },
          dispensations: { none: { status: "COMPLETED" } }, visit: { deletedAt: null }, patient: { deletedAt: null },
        },
      }),
      prisma.dispensation.aggregate({
        where: { tenantId: scope.tenantId, status: "COMPLETED", createdAt: { gte: today0, lt: today1 } },
        _sum: { total: true }, _count: true,
      }),
    ]);
    out.pharmacy = { pendingRx, dispensedToday: today._count, soldToday: Number(today._sum.total ?? 0) };
  }

  return NextResponse.json(out);
}
