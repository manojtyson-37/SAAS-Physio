import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { registerPatientSchema } from "@/lib/hospital/schemas";
import { allocateUhid } from "@/lib/hospital/uhid";
import { getEnabledModules } from "@/lib/modules/guard";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const scope = tenantScope(session);
  const modules = await getEnabledModules(session);
  const billingOn = modules.has("billing");

  // Search boxes ask for a handful (?limit=6); the full list is capped so a big clinic never ships thousands of rows per click.
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  // `lean=1` is for dropdowns that need names only: no money totals, a higher cap, and a 3-column payload.
  const lean = req.nextUrl.searchParams.get("lean") === "1";
  const cap = lean ? 3000 : 500;
  const take = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, cap) : cap;

  const patients = await prisma.patient.findMany({
    where: {
      ...scope,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { uhid: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const where = {
    ...scope,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }, { uhid: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const total = patients.length >= take ? await prisma.patient.count({ where }) : patients.length;
  if (lean) return NextResponse.json({ patients: patients.map((p) => ({ id: p.id, name: p.name, phone: p.phone, uhid: p.uhid })), total });

  // One grouped query for the money columns instead of loading every invoice row of every patient.
  const totals = billingOn && patients.length
    ? await prisma.invoice.groupBy({
        by: ["patientId"],
        where: { ...scope, patientId: { in: patients.map((p) => p.id) }, status: { not: "CANCELLED" }, deletedAt: null },
        _sum: { total: true, paidAmount: true },
      })
    : [];
  const byPatient = new Map(totals.map((t) => [t.patientId, t._sum]));

  const rows = patients.map((p) => {
    const sum = byPatient.get(p.id);
    const billed = Number(sum?.total ?? 0);
    const outstanding = billed - Number(sum?.paidAmount ?? 0);
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      uhid: p.uhid,
      createdAt: p.createdAt,
      reason: p.reason,
      leadSource: modules.has("marketing") ? p.leadSource : null,
      billed,
      outstanding,
    };
  });

  return NextResponse.json({ patients: rows, total });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "STAFF"]);
  if (!session) return response!;

  const parsed = registerPatientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const tenantId = session.tenantId!;
  const uhid = await allocateUhid(prisma, tenantId);
  const patientId = crypto.randomUUID();
  // Batch (non-interactive) transaction: the patient and its audit row commit together.
  const [patient] = await prisma.$transaction([
    prisma.patient.create({ data: { ...parsed.data, id: patientId, uhid, tenantId } }),
    prisma.auditLog.create({
      data: { tenantId, actorId: session.userId, action: "CREATE", entity: "Patient", entityId: patientId },
    }),
  ]);

  return NextResponse.json({ patient });
}
