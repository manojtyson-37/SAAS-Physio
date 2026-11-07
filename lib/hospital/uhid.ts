import type { PrismaClient, Prisma } from "@prisma/client";

/** "UH" + 42 -> "UH-000042". Sequences past 6 digits are kept whole. */
export function formatUhid(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

/**
 * Allocates the next UHID for a tenant with ONE atomic UPDATE ... SET uhidSeq = uhidSeq + 1 RETURNING.
 * The row lock lasts a single statement, so concurrent registrations never get the same
 * number and never queue behind a long transaction. If the patient insert later fails the
 * number is simply skipped: a gap is acceptable for a record number, a duplicate is not.
 */
export async function allocateUhid(
  db: Pick<PrismaClient, "tenant"> | Pick<Prisma.TransactionClient, "tenant">,
  tenantId: string,
): Promise<string> {
  const t = await db.tenant.update({
    where: { id: tenantId },
    data: { uhidSeq: { increment: 1 } },
    select: { uhidPrefix: true, uhidSeq: true },
  });
  return formatUhid(t.uhidPrefix, t.uhidSeq);
}
