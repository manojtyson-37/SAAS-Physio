import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["freeze", "unfreeze", "extend", "refund"]),
  extendDays: z.coerce.number().int().positive().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pkgId: string }> }
) {
  const { session, response } = await requireSession(["CLINIC_ADMIN", "STAFF"]);
  if (!session) return response!;
  const off = await moduleGate(session, "packages");
  if (off) return off;
  const { pkgId } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const pkg = await prisma.package.findFirst({ where: { id: pkgId, tenantId: session.tenantId! } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let data: Record<string, unknown> = {};
  if (parsed.data.action === "freeze") data = { status: "FROZEN" };
  if (parsed.data.action === "unfreeze") data = { status: "ACTIVE" };
  if (parsed.data.action === "refund") data = { status: "REFUNDED" };
  if (parsed.data.action === "extend") {
    const base = pkg.endDate ?? new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + (parsed.data.extendDays ?? 30));
    data = { endDate: newEnd };
  }

  const updated = await prisma.package.update({ where: { id: pkgId }, data });
  return NextResponse.json({ package: { ...updated, price: Number(updated.price) } });
}
