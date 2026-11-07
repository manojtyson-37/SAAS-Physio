import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["CAMPAIGN", "WORKSHOP"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  cost: z.coerce.number().nonnegative(),
  leads: z.coerce.number().int().nonnegative().default(0),
  conversions: z.coerce.number().int().nonnegative().default(0),
  revenue: z.coerce.number().nonnegative().default(0),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "STAFF"]);
  if (!session) return response!;
  const off = await moduleGate(session, "marketing");
  if (off) return off;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: session.tenantId!,
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });

  return NextResponse.json({ campaign });
}
