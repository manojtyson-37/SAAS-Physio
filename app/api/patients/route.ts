import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { registerPatientSchema } from "@/lib/hospital/schemas";
import { allocateUhid } from "@/lib/hospital/uhid";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const scope = tenantScope(session);

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
    include: {
      invoices: { where: { status: { not: "CANCELLED" }, deletedAt: null } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = patients.map((p) => {
    const billed = p.invoices.reduce((s, i) => s + Number(i.total), 0);
    const outstanding = p.invoices.reduce(
      (s, i) => s + (Number(i.total) - Number(i.paidAmount)),
      0
    );
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      uhid: p.uhid,
      createdAt: p.createdAt,
      reason: p.reason,
      leadSource: p.leadSource,
      billed,
      outstanding,
    };
  });

  return NextResponse.json({ patients: rows });
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
