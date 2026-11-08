import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MODULES } from "@/lib/modules/registry";
import { parseSelection, resolveModules } from "@/lib/modules/resolve";
import { platformGate } from "@/lib/platform/gate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET() {
  const g = await platformGate();
  if (!g.session) return g.response;
  return NextResponse.json({ modules: MODULES.map(({ key, label, description, group, requires }) => ({ key, label, description, group, requires: requires ?? [] })) });
}

// Set exactly which modules a clinic has, and whether its own admin may change them (selfService). Switching a module off
// hides it, it never deletes data. Dependencies (pharmacy needs inventory, discharge needs IPD) are added automatically.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const g = await platformGate();
  if (!g.session) return g.response;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { modules?: unknown; selfService?: unknown } | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const data: { enabledModules?: string[]; selfServiceModules?: boolean } = {};
  if (body.modules !== undefined) {
    const sel = parseSelection(body.modules);
    if (!sel.ok) return NextResponse.json({ error: sel.error }, { status: 400 });
    data.enabledModules = sel.modules;
  }
  if (body.selfService !== undefined) {
    if (typeof body.selfService !== "boolean") return NextResponse.json({ error: "selfService must be true or false" }, { status: 400 });
    data.selfServiceModules = body.selfService;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const out = await prisma.$transaction(async (tx) => {
    const before = await tx.tenant.findFirst({ where: { id, deletedAt: null }, select: { enabledModules: true } });
    if (!before) return null;
    const t = await tx.tenant.update({ where: { id }, data, select: { enabledModules: true, selfServiceModules: true } });
    await tx.auditLog.create({ data: { tenantId: id, actorId: g.session.userId, action: "UPDATE", entity: "ClinicModules", entityId: id, diff: { before: before.enabledModules, after: t.enabledModules, selfService: t.selfServiceModules } } });
    return t;
  });
  if (!out) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  return NextResponse.json({ enabled: [...resolveModules(out.enabledModules)], selfService: out.selfServiceModules });
}
