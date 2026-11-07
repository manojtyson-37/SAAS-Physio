import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { createVisitSchema } from "@/lib/hospital/schemas";
import { istDateKey } from "@/lib/hospital/dates";

/** Today's queue by default. ?date=YYYY-MM-DD, ?status=, ?doctorId= narrow it. */
export async function GET(req: NextRequest) {
  const g = await requireTenantSession();
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "opd");
  if (off) return off;

  const sp = req.nextUrl.searchParams;
  const date = sp.get("date") ?? istDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const status = sp.get("status");
  const doctorId = sp.get("doctorId");

  const visits = await prisma.visit.findMany({
    where: {
      tenantId: g.tenantId,
      tokenDate: date,
      deletedAt: null,
      // A doctor sees their own queue; reception/admin see everyone's.
      ...(g.session.role === "DOCTOR" ? { doctorId: g.session.userId } : doctorId ? { doctorId } : {}),
      ...(status && ["WAITING", "IN_CONSULT", "COMPLETED", "CANCELLED"].includes(status)
        ? { status: status as "WAITING" | "IN_CONSULT" | "COMPLETED" | "CANCELLED" }
        : {}),
    },
    include: {
      patient: { select: { id: true, name: true, phone: true, uhid: true, gender: true, dob: true, allergies: true } },
      doctor: { select: { id: true, name: true } },
    },
    orderBy: { tokenNumber: "asc" },
  });

  return NextResponse.json({ date, visits });
}

export async function POST(req: NextRequest) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "STAFF", "DOCTOR"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "opd");
  if (off) return off;

  const parsed = createVisitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const input = parsed.data;

  const [patient, doctor, appointment] = await Promise.all([
    prisma.patient.findFirst({ where: { id: input.patientId, tenantId: g.tenantId, deletedAt: null }, select: { id: true } }),
    prisma.user.findFirst({
      where: { id: input.doctorId, tenantId: g.tenantId, role: "DOCTOR", isActive: true, deletedAt: null },
      select: { id: true },
    }),
    input.appointmentId
      ? prisma.appointment.findFirst({
          where: { id: input.appointmentId, tenantId: g.tenantId, patientId: input.patientId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  if (input.appointmentId && !appointment) {
    return NextResponse.json({ error: "Appointment not found for this patient" }, { status: 404 });
  }

  const tokenDate = istDateKey();

  // Token = next number for the clinic's day. The unique (tenantId, tokenDate, tokenNumber)
  // constraint makes a racing request fail with P2002, so we retry with a fresh max.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Serialize token allocation per clinic-day so a busy reception desk doesn't race
        // (the lock is released at commit; the unique constraint below stays as a backstop).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`visit-token:${g.tenantId}:${tokenDate}`}))`;
        // Same patient already waiting/in consult with this doctor today: report that token instead of a duplicate.
        // Checked inside the lock so two simultaneous requests cannot both pass.
        const open = await tx.visit.findFirst({
          where: { tenantId: g.tenantId, tokenDate, patientId: input.patientId, doctorId: input.doctorId, status: { in: ["WAITING", "IN_CONSULT"] }, deletedAt: null },
          select: { id: true, tokenNumber: true },
        });
        if (open) return { duplicate: open } as const;
        const last = await tx.visit.aggregate({ where: { tenantId: g.tenantId, tokenDate }, _max: { tokenNumber: true } });
        const created = await tx.visit.create({
          data: {
            tenantId: g.tenantId,
            patientId: input.patientId,
            doctorId: input.doctorId,
            appointmentId: input.appointmentId,
            type: input.type,
            chiefComplaint: input.chiefComplaint,
            tokenDate,
            tokenNumber: (last._max.tokenNumber ?? 0) + 1,
          },
        });
        await tx.auditLog.create({
          data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "Visit", entityId: created.id },
        });
        return { created } as const;
      }, { timeout: 20_000, maxWait: 10_000 });
      if ("duplicate" in result) {
        return NextResponse.json({ error: "Patient already has an open visit with this doctor today", visit: result.duplicate }, { status: 409 });
      }
      return NextResponse.json({ visit: result.created }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return NextResponse.json({ error: "Could not allocate a token, please retry" }, { status: 503 });
}
