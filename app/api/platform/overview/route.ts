import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { istDateKey } from "@/lib/hospital/dates";
import { CLINIC_TYPES, type ClinicTypeKey } from "@/lib/modules/clinicTypes";
import { platformGate } from "@/lib/platform/gate";
import { ageHours, needsPlatform } from "@/lib/platform/support";
import { addDays, subscriptionView } from "@/lib/platform/subscription";

// What the platform owner needs each day: who just came on board, what money came in, which clinic queries wait for us.
// Counts and names only. No patient, visit or invoice data of any clinic is read here. Revenue is for the owner only.
export async function GET() {
  const g = await platformGate();
  if (!g.session) return g.response;
  const now = new Date();
  const monthKey = (d: Date) => istDateKey(d).slice(0, 7);

  const [tenants, admins, tickets] = await Promise.all([
    prisma.tenant.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, clinicType: true, plan: true, subscriptionStatus: true, trialEndsAt: true, paidThrough: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { role: "CLINIC_ADMIN", deletedAt: null, tenantId: { not: null } }, select: { tenantId: true, mustChangePassword: true } }),
    prisma.supportTicket.findMany({
      where: { status: { not: "RESOLVED" } },
      orderBy: [{ urgent: "desc" }, { lastMessageAt: "asc" }],
      take: 50,
      select: { id: true, seq: true, subject: true, category: true, urgent: true, status: true, lastBy: true, lastMessageAt: true, tenant: { select: { id: true, name: true } } },
    }),
  ]);

  const adminSignedIn = new Map<string, boolean>();
  for (const a of admins) if (a.tenantId && !a.mustChangePassword) adminSignedIn.set(a.tenantId, true);

  const rows = tenants.map((t) => ({ t, v: subscriptionView({ status: t.subscriptionStatus, trialEndsAt: t.trialEndsAt, paidThrough: t.paidThrough }, now) }));
  const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
  const clinics = {
    total: rows.length,
    onTrial: count((r) => r.v.state === "TRIAL"),
    paid: count((r) => r.v.state === "ACTIVE" || r.v.state === "GRACE"),
    ended: count((r) => r.v.state === "TRIAL_EXPIRED" || r.v.state === "PAID_EXPIRED" || r.v.state === "CANCELLED"),
    suspended: count((r) => r.v.state === "SUSPENDED"),
  };

  const d7 = addDays(now, -7), d30 = addDays(now, -30);
  const onboardings = {
    last7: tenants.filter((t) => t.createdAt >= d7).length,
    last30: tenants.filter((t) => t.createdAt >= d30).length,
    recent: rows.slice(0, 8).map(({ t, v }) => ({
      id: t.id, name: t.name, type: CLINIC_TYPES[t.clinicType as ClinicTypeKey]?.label ?? t.clinicType, createdAt: t.createdAt,
      state: v.state, daysLeft: v.daysLeft, plan: t.plan, adminSignedIn: adminSignedIn.get(t.id) === true,
    })),
    notYetSignedIn: rows.filter(({ t }) => t.createdAt >= d30 && !adminSignedIn.get(t.id)).length,
  };

  const trialsEnding = rows
    .filter(({ v }) => v.state === "TRIAL" && v.daysLeft !== null && v.daysLeft <= 7)
    .sort((a, b) => (a.v.daysLeft ?? 0) - (b.v.daysLeft ?? 0))
    .map(({ t, v }) => ({ id: t.id, name: t.name, daysLeft: v.daysLeft, endsAt: v.endsAt }));
  const renewalsDue = rows
    .filter(({ v }) => (v.state === "ACTIVE" && v.daysLeft !== null && v.daysLeft <= 7) || v.state === "GRACE")
    .map(({ t, v }) => ({ id: t.id, name: t.name, daysLeft: v.daysLeft, state: v.state, paidThrough: t.paidThrough }));

  const queries = {
    open: tickets.length,
    urgent: tickets.filter((t) => t.urgent).length,
    waitingOnUs: tickets.filter(needsPlatform).length,
    oldestWaitingHours: tickets.filter(needsPlatform).reduce((m, t) => Math.max(m, ageHours(t.lastMessageAt, now)), 0),
    latest: tickets.slice(0, 8).map((t) => ({ id: t.id, number: `TKT-${t.seq}`, subject: t.subject, category: t.category, urgent: t.urgent, status: t.status, needsUs: needsPlatform(t), waitingHours: ageHours(t.lastMessageAt, now), clinic: t.tenant })),
  };

  let revenue: null | {
    thisMonth: number; last30: number; allTime: number; payments: number;
    byMonth: { month: string; amount: number }[]; recent: { id: string; clinic: string; amount: number; plan: string | null; at: Date }[];
  } = null;
  if (g.owner) {
    const pays = await prisma.subscriptionPayment.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, amount: true, plan: true, createdAt: true, tenant: { select: { name: true } } } });
    const sum = (xs: typeof pays) => Math.round(xs.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 15)));
    revenue = {
      thisMonth: sum(pays.filter((p) => monthKey(p.createdAt) === monthKey(now))),
      last30: sum(pays.filter((p) => p.createdAt >= d30)),
      allTime: sum(pays),
      payments: pays.length,
      byMonth: months.map((m) => ({ month: m, amount: sum(pays.filter((p) => monthKey(p.createdAt) === m)) })),
      recent: pays.slice(0, 6).map((p) => ({ id: p.id, clinic: p.tenant.name, amount: Number(p.amount), plan: p.plan, at: p.createdAt })),
    };
  }

  return NextResponse.json({ owner: g.owner, clinics, onboardings, trialsEnding, renewalsDue, queries, revenue }, { headers: { "Cache-Control": "no-store" } });
}
