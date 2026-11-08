import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ipdGate } from "@/lib/ipd/gate";
import { bedStatus } from "@/lib/ipd/rules";
import { admissionSelect, admissionView } from "@/lib/ipd/view";

// Any clinic user may view the board.
export async function GET() {
  const g = await ipdGate("ipd");
  if (!g.session) return g.response;
  const now = new Date();
  const [wards, admitted] = await Promise.all([
    prisma.ward.findMany({
      where: { tenantId: g.tenantId }, orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, isActive: true, beds: { orderBy: { label: "asc" }, select: { id: true, label: true, dailyRate: true, isActive: true } } },
    }),
    prisma.admission.findMany({ where: { tenantId: g.tenantId, status: "ADMITTED", deletedAt: null }, orderBy: { admittedAt: "asc" }, select: admissionSelect }),
  ]);
  const byBed = new Map(admitted.filter((a) => a.bedId).map((a) => [a.bedId!, admissionView(a, now)]));
  const out = wards.map((w) => ({
    id: w.id, name: w.name, type: w.type, isActive: w.isActive,
    beds: w.beds.map((b) => {
      const admission = byBed.get(b.id) ?? null;
      return { id: b.id, label: b.label, dailyRate: Number(b.dailyRate), isActive: b.isActive, status: bedStatus({ isActive: b.isActive, wardActive: w.isActive }, !!admission), admission };
    }),
  }));
  const unassigned = admitted.filter((a) => !a.bedId).map((a) => admissionView(a, now));
  return NextResponse.json({ wards: out, unassigned });
}
