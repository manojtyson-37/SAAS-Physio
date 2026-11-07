import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";

const PATIENT_DIMS = ["punctuality", "attentionToDetail", "understanding", "communication", "overallExperience"];
const DEPT_DIMS = ["clinicalSkills", "documentation", "knowledge", "caseManagement"];

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const off = await moduleGate(session, "ratings");
  if (off) return off;
  const scope = tenantScope(session);

  const doctorId = req.nextUrl.searchParams.get("doctorId");

  const doctors = await prisma.user.findMany({
    where: { ...scope, role: "DOCTOR" },
    orderBy: { name: "asc" },
  });

  if (!doctorId) {
    return NextResponse.json({ doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty })) });
  }

  const ratings = await prisma.rating.findMany({
    where: { ...scope, doctorId },
    orderBy: { date: "desc" },
  });

  const patientRatings = ratings.filter((r) => r.type === "PATIENT");
  const deptRatings = ratings.filter((r) => r.type === "DEPT_HEAD");

  function avgDims(rows: typeof ratings, dims: string[]) {
    const out: Record<string, number> = {};
    for (const dim of dims) {
      const vals = rows
        .map((r) => (r.scores as Record<string, number>)[dim])
        .filter((v) => typeof v === "number");
      out[dim] = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : 0;
    }
    return out;
  }

  return NextResponse.json({
    doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty })),
    patientCount: patientRatings.length,
    deptCount: deptRatings.length,
    patientAvg: avgDims(patientRatings, PATIENT_DIMS),
    deptAvg: avgDims(deptRatings, DEPT_DIMS),
    recent: ratings.slice(0, 15).map((r) => ({
      id: r.id,
      type: r.type,
      date: r.date,
      scores: r.scores,
      comment: r.comment,
    })),
  });
}
