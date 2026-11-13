import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { activeUserInTenant, patientInTenant } from "@/lib/tenant/guards";
import { z } from "zod";

function dayRange(dateStr: string) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const off = await moduleGate(session, "attendance");
  if (off) return off;
  const scope = tenantScope(session);

  const dateStr = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const date = dayRange(dateStr);

  const [staff, patients, records] = await Promise.all([
    // Same filters the POST guards apply, so the screen never offers a row that would 404 on marking.
    prisma.user.findMany({ where: { ...scope, isActive: true, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.patient.findMany({ where: { ...scope, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.attendanceRecord.findMany({ where: { ...scope, date } }),
  ]);

  const staffStatus = new Map(records.filter((r) => r.userId).map((r) => [r.userId, r.status]));
  const patientStatus = new Map(records.filter((r) => r.patientId).map((r) => [r.patientId, r.status]));

  return NextResponse.json({
    date: dateStr,
    staff: staff.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      status: staffStatus.get(u.id) ?? "UNMARKED",
    })),
    patients: patients.map((p) => ({
      id: p.id,
      name: p.name,
      status: patientStatus.get(p.id) ?? "UNMARKED",
    })),
  });
}

const schema = z
  .object({
    date: z.string().min(1),
    subject: z.enum(["STAFF", "PATIENT"]),
    userId: z.string().optional(),
    patientId: z.string().optional(),
    status: z.enum(["PRESENT", "LEAVE", "ABSENT", "LATE"]),
  })
  // The upsert key below needs whichever id the subject implies, so require it here
  // rather than letting an undefined id reach Prisma.
  .refine((d) => (d.subject === "STAFF" ? !!d.userId : !!d.patientId), {
    message: "Mark attendance against a staff member or a patient",
  });

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "STAFF"]);
  if (!session) return response!;
  const off = await moduleGate(session, "attendance");
  if (off) return off;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const date = dayRange(parsed.data.date);
  const { subject, userId, patientId, status } = parsed.data;

  // Both ids come from the request body. The upsert key is scoped to the clinic, so an id
  // from another clinic would not match an existing row — it would create a new one here
  // pointing at their patient or their staff member. Resolve it first.
  const subjectRow =
    subject === "STAFF"
      ? await prisma.user.findFirst({ where: activeUserInTenant(session.tenantId!, userId!), select: { id: true } })
      : await prisma.patient.findFirst({ where: patientInTenant(session.tenantId!, patientId!), select: { id: true } });
  if (!subjectRow) {
    return NextResponse.json({ error: subject === "STAFF" ? "Staff member not found" : "Patient not found" }, { status: 404 });
  }

  const where: Prisma.AttendanceRecordWhereUniqueInput =
    subject === "STAFF"
      ? { tenantId_date_userId: { tenantId: session.tenantId!, date, userId: subjectRow.id } }
      : { tenantId_date_patientId: { tenantId: session.tenantId!, date, patientId: subjectRow.id } };

  const record = await prisma.attendanceRecord.upsert({
    where,
    create: {
      tenantId: session.tenantId!,
      date,
      subject,
      userId: subject === "STAFF" ? subjectRow.id : undefined,
      patientId: subject === "PATIENT" ? subjectRow.id : undefined,
      status,
    },
    update: { status },
  });

  return NextResponse.json({ record });
}
