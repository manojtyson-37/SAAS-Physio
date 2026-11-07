import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { registerPatientSchema } from "@/lib/hospital/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const scope = tenantScope(session);

  const patient = await prisma.patient.findFirst({
    where: { id, ...scope },
    include: {
      packages: { orderBy: { createdAt: "desc" } },
      invoices: { where: { deletedAt: null }, orderBy: { date: "desc" } },
      appointments: { include: { doctor: { select: { id: true, name: true, specialty: true, title: true } } }, orderBy: { datetime: "desc" } },
      clinicalNotes: { include: { author: { select: { id: true, name: true, title: true } } }, orderBy: { date: "desc" } },
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cancelled invoices stay in the list but never count towards what was billed or paid.
  const live = patient.invoices.filter((i) => i.status !== "CANCELLED" && !i.deletedAt);
  const billed = live.reduce((s, i) => s + Number(i.total), 0);
  const paid = live.reduce((s, i) => s + Number(i.paidAmount), 0);

  return NextResponse.json({
    patient: {
      ...patient,
      packages: patient.packages.map((p) => ({ ...p, price: Number(p.price) })),
      invoices: patient.invoices.map((i) => ({
        ...i,
        subtotal: Number(i.subtotal),
        gst: Number(i.gst),
        total: Number(i.total),
        paidAmount: Number(i.paidAmount),
      })),
      billed,
      paid,
      outstanding: billed - paid,
    },
  });
}

/** Edit demographics. UHID is assigned once at registration and never changes. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "STAFF"]);
  if (!session) return response!;
  const { id } = await params;

  // "" or null means "clear this field"; everything else is validated as on registration.
  const raw = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const CLEARABLE = ["gender", "dob", "bloodGroup", "allergies", "abhaId", "address", "reason", "referralDoctor", "notes"];
  const clears = CLEARABLE.filter((k) => raw[k] === "" || raw[k] === null);
  const toValidate = Object.fromEntries(Object.entries(raw).filter(([k]) => !clears.includes(k)));
  const parsed = registerPatientSchema.partial().safeParse(toValidate);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = { ...parsed.data, ...Object.fromEntries(clears.map((k) => [k, null])) };
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const existing = await prisma.patient.findFirst({ where: { id, ...tenantScope(session), deletedAt: null }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patient = await prisma.patient.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { tenantId: session.tenantId, actorId: session.userId, action: "UPDATE", entity: "Patient", entityId: id },
  });
  return NextResponse.json({ patient });
}
