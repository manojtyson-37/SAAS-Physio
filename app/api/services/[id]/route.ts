import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";
import { updateServiceSchema } from "@/lib/hospital/billingSchemas";

/** Edit a price-list item or deactivate it. Invoices keep their own copy of description and price, so edits never change past bills. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireTenantSession(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "billing");
  if (off) return off;
  const { id } = await params;

  const parsed = updateServiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  if (Object.keys(d).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  try {
    const { count } = await prisma.serviceItem.updateMany({
      where: { id, tenantId: g.tenantId },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.category !== undefined ? { category: d.category } : {}),
        ...(d.price !== undefined ? { price: d.price.toFixed(2) } : {}),
        ...(d.gstPercent !== undefined ? { gstPercent: d.gstPercent.toFixed(2) } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A service with that name already exists" }, { status: 409 });
    }
    console.error("service update failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
