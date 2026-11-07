import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  const { session, response } = await requireSession(["SUPER_ADMIN"]);
  if (!session) return response!;

  const tenants = await prisma.tenant.findMany({
    include: {
      branches: true,
      users: true,
      patients: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    tenants: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      address: t.address,
      gstNumber: t.gstNumber,
      branchCount: t.branches.length,
      staffCount: t.users.length,
      patientCount: t.patients.length,
      createdAt: t.createdAt,
    })),
  });
}

const schema = z.object({
  name: z.string().min(1),
  gstNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(["SUPER_ADMIN"]);
  if (!session) return response!;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.adminEmail } });
  if (existing) return NextResponse.json({ error: "Admin email already in use" }, { status: 409 });

  const { adminName, adminEmail, adminPassword, ...tenantData } = parsed.data;

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantData.name,
      gstNumber: tenantData.gstNumber,
      phone: tenantData.phone,
      email: tenantData.email || undefined,
      address: tenantData.address,
      users: {
        create: {
          name: adminName,
          email: adminEmail,
          passwordHash: await hashPassword(adminPassword),
          role: "CLINIC_ADMIN",
        },
      },
    },
    include: { users: { select: { id: true, name: true, email: true, role: true } } },
  });

  return NextResponse.json({ tenant });
}
