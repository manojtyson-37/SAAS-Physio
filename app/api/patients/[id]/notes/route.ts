import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { patientInTenant } from "@/lib/tenant/guards";
import { z } from "zod";

const schema = z.object({ note: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "DOCTOR", "STAFF"]);
  if (!session) return response!;
  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  // ClinicalNote carries no tenantId of its own, so the patient is the only thing that
  // keeps the row in this clinic. Resolve it here or the note lands in another clinic's
  // medical record, attributed to a doctor they have never heard of.
  const patient = await prisma.patient.findFirst({
    where: patientInTenant(session.tenantId!, id),
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const note = await prisma.clinicalNote.create({
    data: { patientId: patient.id, authorId: session.userId, note: parsed.data.note },
    include: { author: { select: { id: true, name: true, title: true } } },
  });

  return NextResponse.json({ note });
}
