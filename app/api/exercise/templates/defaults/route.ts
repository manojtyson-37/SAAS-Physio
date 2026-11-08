import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/hospital/http";
import { audit, TX_OPTS } from "@/lib/exercise/db";
import { exerciseGate, PRESCRIBERS } from "@/lib/exercise/gate";
import { STARTER_TEMPLATES } from "@/lib/exercise/starterTemplates";

// Load the starter library. Additive and idempotent: names the clinic already has (even deactivated) are skipped, nothing is overwritten.
// Write: doctor + clinic admin.
export async function POST() {
  const g = await exerciseGate(PRESCRIBERS);
  if (!g.session) return g.response;
  try {
    const added = await prisma.$transaction(async (tx) => {
      const r = await tx.exerciseTemplate.createMany({
        data: STARTER_TEMPLATES.map((t) => ({ tenantId: g.tenantId, name: t.name, category: t.category, description: t.description, sets: t.sets, reps: t.reps, holdSeconds: t.holdSeconds, instructions: t.instructions })),
        skipDuplicates: true,
      });
      if (r.count > 0) await audit(tx, g.tenantId, g.session.userId, "CREATE", "ExerciseTemplate", `defaults:${r.count}`);
      return r.count;
    }, TX_OPTS);
    return NextResponse.json({ added, skipped: STARTER_TEMPLATES.length - added });
  } catch (e) {
    return toErrorResponse(e);
  }
}
