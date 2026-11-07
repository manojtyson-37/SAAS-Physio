import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
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

  const appt = await prisma.appointment.create({
    data: {
      tenantId: session.tenantId!,
      patientId: parsed.data.patientId,
      doctorId: parsed.data.doctorId,
      datetime: new Date(parsed.data.datetime),
      durationMin: parsed.data.durationMin,
      notes: parsed.data.notes,
    },
    include: { patient: true, doctor: { select: { id: true, name: true, specialty: true, title: true } } },
  });

  return NextResponse.json({ appointment: appt });
}
