/**
 * Creates or resets a PLATFORM login (the owner "SUPER_ADMIN" or the onboarding team "ONBOARDING") with a random
 * password that is written to a private file on THIS machine and never printed.
 *
 *   npx tsx scripts/create-platform-login.ts --email=master@clinicos.internal --name="ClinicOS Owner" --role=SUPER_ADMIN            # dry run
 *   npx tsx scripts/create-platform-login.ts --email=... --name=... --role=SUPER_ADMIN --apply --host=<part of DB host>
 *   ... --retire=superadmin@physiocare.io        # also deactivates the old public demo owner login (kept in the database, not deleted)
 *
 * The password file is ~/.clinicos-credentials/<email>.txt (mode 600). The login is flagged to change its password at
 * first sign-in, so the file only has to survive until then. Delete the file afterwards.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateTempPassword } from "../lib/platform/password";

const prisma = new PrismaClient();
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@([^/:?]+).*$/, "$1");
  const apply = process.argv.includes("--apply");
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const role = arg("role");
  const retire = arg("retire")?.trim().toLowerCase();
  if (!email || !name || (role !== "SUPER_ADMIN" && role !== "ONBOARDING")) throw new Error("Usage: --email=... --name=... --role=SUPER_ADMIN|ONBOARDING [--retire=old@email] [--apply --host=...]");
  const want = arg("host");
  if (apply && (!want || !host.includes(want))) throw new Error(`Refusing to write: pass --host=<part of the database host> matching ${host}`);

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, role: true, tenantId: true } });
  if (existing && (existing.tenantId || (existing.role !== "SUPER_ADMIN" && existing.role !== "ONBOARDING"))) throw new Error("That email belongs to a clinic user. Choose a different email.");
  const old = retire ? await prisma.user.findFirst({ where: { email: { equals: retire, mode: "insensitive" }, role: "SUPER_ADMIN" }, select: { id: true, isActive: true } }) : null;

  console.log(`Target host: ${host}\nMode: ${apply ? "APPLY" : "dry run (no writes)"}`);
  console.log(`- ${existing ? "reset password and keep" : "create"} ${role} login ${email}`);
  if (retire) console.log(`- ${old ? (old.isActive ? `deactivate old owner login ${retire} (kept, not deleted)` : `${retire} already inactive`) : `${retire} not found`}`);
  if (!apply) return;

  const temp = generateTempPassword(20);
  const passwordHash = await bcrypt.hash(temp, 10);
  if (existing) await prisma.user.update({ where: { id: existing.id }, data: { name, role, passwordHash, mustChangePassword: true, isActive: true } });
  else await prisma.user.create({ data: { name, email, role, tenantId: null, passwordHash, mustChangePassword: true } });
  if (old?.isActive) await prisma.user.update({ where: { id: old.id }, data: { isActive: false } });

  const dir = path.join(os.homedir(), ".clinicos-credentials");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${email.replace(/[^a-z0-9@._-]/g, "_")}.txt`);
  fs.writeFileSync(file, `ClinicOS ${role} login\nemail: ${email}\ntemporary password: ${temp}\nSign in at https://clinicos-cloud.vercel.app/login. You must choose a new password at first sign-in. Delete this file afterwards.\n`, { mode: 0o600 });
  console.log(`Done. The temporary password was written to ${file} (not shown here).`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
