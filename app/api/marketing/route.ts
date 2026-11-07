import { moduleGate } from "@/lib/modules/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const off = await moduleGate(session, "marketing");
  if (off) return off;
  const scope = tenantScope(session);

  const [campaigns, referrals] = await Promise.all([
    prisma.campaign.findMany({ where: scope, orderBy: { startDate: "desc" } }),
    prisma.referral.findMany({ where: scope, orderBy: { date: "desc" } }),
  ]);

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.cost), 0);
  const revenueAttributed =
    campaigns.reduce((s, c) => s + Number(c.revenue), 0) +
    referrals.reduce((s, r) => s + Number(r.revenueGenerated), 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const overallRoi = totalSpend > 0 ? Math.round((revenueAttributed / totalSpend) * 100) : 0;

  return NextResponse.json({
    totalSpend,
    revenueAttributed,
    overallRoi,
    totalLeads,
    campaigns: campaigns.map((c) => ({
      ...c,
      cost: Number(c.cost),
      revenue: Number(c.revenue),
      roi: Number(c.cost) > 0 ? Math.round((Number(c.revenue) / Number(c.cost)) * 100) : 0,
    })),
    referrals: referrals.map((r) => ({ ...r, revenueGenerated: Number(r.revenueGenerated) })),
  });
}
