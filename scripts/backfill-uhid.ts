/**
 * Assigns UHIDs to patients that registered before UHIDs existed (uhid IS NULL), oldest first.
 * Only ever UPDATEs the uhid column of NULL rows and the tenant's uhidSeq; never deletes.
 *
 *   npx tsx scripts/backfill-uhid.ts                                  # dry run (default): prints the plan
 *   BACKFILL_CONFIRM=<db host> npx tsx scripts/backfill-uhid.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { formatUhid } from "../lib/hospital/uhid";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://missing").hostname;
  console.log(`Target host: ${host}\nMode: ${apply ? "APPLY" : "dry run (no writes)"}`);

  if (apply && process.env.BACKFILL_CONFIRM !== host) {
    console.error(`ABORTED: set BACKFILL_CONFIRM=${host} to confirm you intend to write to this database.`);
    process.exit(1);
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, uhidPrefix: true, uhidSeq: true } });
  for (const t of tenants) {
    const patients = await prisma.patient.findMany({
      where: { tenantId: t.id, uhid: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (patients.length === 0) {
      console.log(`- ${t.name}: nothing to backfill`);
      continue;
    }
    const first = formatUhid(t.uhidPrefix, t.uhidSeq + 1);
    const last = formatUhid(t.uhidPrefix, t.uhidSeq + patients.length);
    console.log(`- ${t.name}: ${patients.length} patients -> ${first} .. ${last}`);
    if (!apply) continue;

    await prisma.$transaction(
      async (tx) => {
        // Re-read the counter under the transaction so a registration during the run cannot collide.
        const cur = await tx.tenant.update({
          where: { id: t.id },
          data: { uhidSeq: { increment: patients.length } },
          select: { uhidSeq: true },
        });
        let seq = cur.uhidSeq - patients.length;
        for (const p of patients) {
          seq += 1;
          await tx.patient.updateMany({ where: { id: p.id, uhid: null }, data: { uhid: formatUhid(t.uhidPrefix, seq) } });
        }
      },
      { timeout: 60_000 },
    );
    console.log(`  applied for ${t.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
