import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { audit, templateView, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PRESCRIBERS } from "@/lib/exercise/gate";
import { templateSchema } from "@/lib/exercise/schemas";

// Read: any clinic user. ?active=1 hides deactivated templates (used by the plan builder).
export async function GET(req: NextRequest) {
  const g = await exerciseGate();
  if (!g.session) return g.response;
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const rows = await prisma.exerciseTemplate.findMany({
    where: {
      tenantId: g.tenantId, deletedAt: null,
      ...(sp.get("active") === "1" ? { isActive: true } : {}),
      ...(sp.get("category") ? { category: sp.get("category")! } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ templates: rows.map(templateView) });
}

// Write: doctor + clinic admin (clinical content).
export async function POST(req: NextRequest) {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  const parsed = templateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;
  try {
    const t = await prisma.$transaction(async (tx) => {
      const clash = await tx.exerciseTemplate.findFirst({ where: { tenantId: g.tenantId, name: { equals: d.name, mode: "insensitive" } }, select: { id: true } });
      if (clash) throw new HttpError(409, "A template with this name already exists");
      const row = await tx.exerciseTemplate.create({
        data: { tenantId: g.tenantId, name: d.name, category: d.category, description: d.description, sets: d.sets ?? null, reps: d.reps ?? null, holdSeconds: d.holdSeconds ?? null, instructions: d.instructions },
      });
      await audit(tx, g.tenantId, g.session.userId, "CREATE", "ExerciseTemplate", row.id);
      return row;
    }, TX_OPTS);
    return NextResponse.json({ template: templateView(t) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "A template with this name already exists" }, { status: 409 });
    return toErrorResponse(e);
  }
}
