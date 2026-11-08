import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { ipdGate, WARD_ROLES } from "@/lib/ipd/gate";
import { admit } from "@/lib/ipd/service";
import { admitSchema } from "@/lib/ipd/schemas";
import { admissionSelect, admissionView } from "@/lib/ipd/view";

// Any clinic user may list. ?status=ADMITTED|DISCHARGED, ?q= (name, UHID, admission no), ?patientId=
export async function GET(req: NextRequest) {
  const g = await ipdGate("ipd");
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const patientId = sp.get("patientId");
  const rows = await prisma.admission.findMany({
    where: {
      tenantId: g.tenantId, deletedAt: null,
      ...(status === "ADMITTED" || status === "DISCHARGED" ? { status } : {}),
      ...(patientId ? { patientId } : {}),
      ...(q ? { OR: [{ admissionNo: { contains: q, mode: "insensitive" } }, { patient: { name: { contains: q, mode: "insensitive" } } }, { patient: { uhid: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    orderBy: { admittedAt: "desc" }, take: 200, select: admissionSelect,
  });
  const now = new Date();
  return NextResponse.json({ admissions: rows.map((a) => admissionView(a, now)) });
}

// Admit: ward staff, doctors and admin.
export async function POST(req: NextRequest) {
  const g = await ipdGate("ipd", WARD_ROLES);
  if (!g.session) return g.response;
  const parsed = admitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const r = await admit({ ...parsed.data, tenantId: g.tenantId, userId: g.session.userId });
    return NextResponse.json(r, { status: r.replay ? 200 : 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
