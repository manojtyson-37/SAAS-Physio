import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/auth";
import { allModules, resolveModules } from "./resolve";
import type { ModuleKey } from "./registry";
import { sessionModules } from "./sessionModules";

/** The clinic's enabled modules. Super admin has no clinic and sees everything. */
export async function getEnabledModules(session: Pick<SessionPayload, "role" | "tenantId">): Promise<Set<ModuleKey>> {
  if (session.role === "SUPER_ADMIN" || !session.tenantId) return allModules();
  const known = sessionModules.get(session);
  if (known) return resolveModules(known);
  const t = await prisma.tenant.findFirst({ where: { id: session.tenantId, deletedAt: null }, select: { enabledModules: true } });
  return resolveModules(t?.enabledModules);
}

/** For API routes: returns a 403 response when the module is off for this clinic, otherwise null. */
export async function moduleGate(
  session: Pick<SessionPayload, "role" | "tenantId">,
  key: ModuleKey
): Promise<NextResponse | null> {
  const on = await getEnabledModules(session);
  if (on.has(key)) return null;
  return NextResponse.json({ error: "This module is not enabled for your clinic" }, { status: 403 });
}

/** For module layouts: pages of a disabled module behave as if they do not exist. */
export async function assertModulePage(key: ModuleKey) {
  const session = await getSession();
  if (!session) return; // the app layout redirects to login
  const on = await getEnabledModules(session);
  if (!on.has(key)) notFound();
}
