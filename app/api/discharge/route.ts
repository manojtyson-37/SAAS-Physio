import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ipdGate } from "@/lib/ipd/gate";

// Any clinic user may list. ?status=DRAFT|FINAL, ?q= (patient name, UHID, admission no).
// `missing` = discharged admissions that have no summary yet (e.g. discharged before the module was switched on).
export async function GET(req: NextRequest) {
  const g = await ipdGate("discharge");
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const who = q ? { OR: [{ admissionNo: { contains: q, mode: "insensitive" as const } }, { patient: { name: { contains: q, mode: "insensitive" as const } } }, { patient: { uhid: { contains: q, mode: "insensitive" as const } } }] } : {};
  const sel = { id: true, admissionNo: true, admittedAt: true, dischargedAt: true, patient: { select: { id: true, name: true, uhid: true } } } as const;
  const [rows, missing] = await Promise.all([
    prisma.dischargeSummary.findMany({
      where: { tenantId: g.tenantId, ...(status === "DRAFT" || status === "FINAL" ? { status } : {}), admission: { deletedAt: null, ...who } },
      orderBy: { updatedAt: "desc" }, take: 200,
      select: { id: true, status: true, diagnosis: true, finalizedAt: true, updatedAt: true, doctor: { select: { id: true, name: true, title: true } }, admission: { select: sel } },
    }),
    status === "FINAL" ? Promise.resolve([]) : prisma.admission.findMany({
      where: { tenantId: g.tenantId, status: "DISCHARGED", deletedAt: null, discharge: null, ...who },
      orderBy: { dischargedAt: "desc" }, take: 50, select: { ...sel, diagnosis: true },
    }),
  ]);
  return NextResponse.json({ summaries: rows, missing });
}
