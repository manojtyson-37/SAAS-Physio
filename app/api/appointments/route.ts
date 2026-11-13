import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { activeDoctorInTenant, patientInTenant } from "@/lib/tenant/guards";
import { z } from "zod";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const off = await moduleGate(session, "appointments");
  if (off) return off;
  const scope = tenantScope(session);

  const appointments = await prisma.appointment.findMany({
    where: scope,
    include: { patient: true, doctor: { select: { id: true, name: true, specialty: true, title: true } } },
    orderBy: { datetime: "asc" },
  });

  return NextResponse.json({ appointments });
}

const schema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  datetime: z.string().min(1),
  durationMin: z.coerce.number().int().positive().default(45),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "STAFF", "DOCTOR"]);
  if (!session) return response!;
  const off = await moduleGate(session, "appointments");
  if (off) return off;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  // Both ids come from the request. Without these two lookups the appointment is written
  // into this clinic but points at another clinic's patient and doctor — and the response
  // below includes the patient row, so it hands that record back to the caller.
  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: patientInTenant(session.tenantId!, parsed.data.patientId), select: { id: true } }),
    prisma.user.findFirst({ where: activeDoctorInTenant(session.tenantId!, parsed.data.doctorId), select: { id: true } }),
  ]);
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const appt = await prisma.appointment.create({
    data: {
      tenantId: session.tenantId!,
      patientId: patient.id,
      doctorId: doctor.id,
      datetime: new Date(parsed.data.datetime),
      durationMin: parsed.data.durationMin,
      notes: parsed.data.notes,
    },
    include: { patient: true, doctor: { select: { id: true, name: true, specialty: true, title: true } } },
  });

  return NextResponse.json({ appointment: appt });
}
