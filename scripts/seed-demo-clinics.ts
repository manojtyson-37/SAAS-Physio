/**
 * Adds the demo clinics (one per clinic type) to a database. ADDITIVE ONLY: existing clinics and data are
 * never changed or deleted, and a clinic whose admin login already exists is skipped.
 *
 *   npx tsx scripts/seed-demo-clinics.ts           # dry run: shows what would be created
 *   npx tsx scripts/seed-demo-clinics.ts --apply   # creates the missing demo clinics
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_CLINICS, DEMO_PASSWORD, seedDemoClinic } from "../prisma/demoClinics";

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^.*@([^/:?]+).*$/, "$1");
  const apply = process.argv.includes("--apply");
  console.log(`Target host: ${host}`);
  console.log(`Mode: ${apply ? "APPLY (additive: creates missing demo clinics only)" : "dry run (no writes)"}`);

  const before = await prisma.tenant.count();
  console.log(`Clinics currently in this database: ${before}`);

  for (const c of DEMO_CLINICS) {
    const exists = await prisma.user.findUnique({ where: { email: c.admin.email }, select: { id: true } });
    if (!apply) {
      console.log(`- ${c.name} (${c.clinicType}): ${exists ? "already exists, would skip" : "would create"}`);
      continue;
    }
    const r = await seedDemoClinic(prisma, c);
    console.log(`- ${r.clinic}: ${r.skipped ? "skipped (" + r.note + ")" : "created (" + r.note + ")"}`);
  }

  if (apply) {
    console.log(`Clinics now: ${await prisma.tenant.count()} (was ${before}). Demo password for all demo logins: ${DEMO_PASSWORD}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
