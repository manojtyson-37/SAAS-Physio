import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  totalSessions: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "STAFF"]);
  if (!session) return response!;
  const off = await moduleGate(session, "packages");
  if (off) return off;
  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const pkg = await prisma.package.create({
    data: {
      tenantId: session.tenantId!,
      patientId: id,
      name: parsed.data.name,
      totalSessions: parsed.data.totalSessions,
      price: parsed.data.price,
    },
  });

  return NextResponse.json({ package: { ...pkg, price: Number(pkg.price) } });
}
