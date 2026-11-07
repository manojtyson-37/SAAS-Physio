import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { serviceSchema } from "@/lib/hospital/billingSchemas";

const view = (s: { id: string; name: string; category: string; price: Prisma.Decimal; gstPercent: Prisma.Decimal; isActive: boolean }) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  price: Number(s.price),
  gstPercent: Number(s.gstPercent),
  isActive: s.isActive,
});

/** Active price list for everyone in the clinic; ?all=1 (admin only) includes deactivated items. */
export async function GET(req: NextRequest) {
  const g = await requireTenantSession();
  if (!g.session) return g.response;
  const all = req.nextUrl.searchParams.get("all") === "1" && g.session.role === "CLINIC_ADMIN";

  const services = await prisma.serviceItem.findMany({
    where: { tenantId: g.tenantId, ...(all ? {} : { isActive: true }) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ services: services.map(view) });
}

export async function POST(req: NextRequest) {
  const g = await requireTenantSession(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;

  const parsed = serviceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const s = await prisma.serviceItem.create({
      data: {
        tenantId: g.tenantId,
        name: parsed.data.name,
        category: parsed.data.category,
        price: parsed.data.price.toFixed(2),
        gstPercent: parsed.data.gstPercent.toFixed(2),
      },
    });
    return NextResponse.json({ service: view(s) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A service with that name already exists" }, { status: 409 });
    }
    console.error("service create failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
