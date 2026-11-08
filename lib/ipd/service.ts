import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/hospital/http";
import { paiseToDecimal, toPaise } from "@/lib/hospital/billing";
import { createInvoiceInTx } from "@/lib/hospital/invoiceTx";
import { bedCharges } from "./billing";
import { bedBlockReason, formatAdmissionNo } from "./rules";

export const TX = { timeout: 20_000, maxWait: 10_000 } as const;
type Tx = Prisma.TransactionClient;

type BedRow = { id: string; label: string; isActive: boolean; wardActive: boolean; wardName: string; rate: number };

/**
 * Locks a bed row (and shares a lock on its ward so a ward cannot be switched off mid-admit).
 * Callers lock several beds in id order so two transfers can never deadlock each other.
 */
async function lockBed(tx: Tx, tenantId: string, bedId: string): Promise<BedRow> {
  const rows = await tx.$queryRaw<BedRow[]>`
    SELECT b.id, b.label, b."isActive", w."isActive" AS "wardActive", w.name AS "wardName", b."dailyRate"::float8 AS rate
    FROM "Bed" b JOIN "Ward" w ON w.id = b."wardId"
    WHERE b.id = ${bedId} AND b."tenantId" = ${tenantId}
    FOR UPDATE OF b FOR SHARE OF w`;
  if (rows.length === 0) throw new HttpError(404, "Bed not found");
  return rows[0];
}

async function assertBedFree(tx: Tx, bed: BedRow, exceptAdmissionId?: string) {
  const occupied = (await tx.admission.count({ where: { bedId: bed.id, status: "ADMITTED", ...(exceptAdmissionId ? { id: { not: exceptAdmissionId } } : {}) } })) > 0;
  const why = bedBlockReason(bed, occupied);
  if (why) throw new HttpError(409, why);
}

/** The partial unique index "one ADMITTED admission per bed" is the last line of defence; show it as a plain conflict. */
function mapBedRace<T>(p: Promise<T>): Promise<T> {
  return p.catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "That bed was just taken. Pick another");
    throw e;
  });
}

export type AdmitInput = {
  tenantId: string; userId: string; patientId: string; doctorId: string; bedId?: string;
  reason?: string; diagnosis?: string; expectedDischargeAt?: string; clientRef?: string;
};

export async function admit(input: AdmitInput) {
  const { tenantId } = input;
  return mapBedRace(prisma.$transaction(async (tx) => {
    if (input.clientRef) {
      // Serialise retries of the same request: the second waits here, then finds the first one's admission.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ":adm:" + input.clientRef}))`;
      const replay = await tx.admission.findUnique({ where: { tenantId_clientRef: { tenantId, clientRef: input.clientRef } }, select: { id: true, admissionNo: true, patientId: true } });
      if (replay) {
        if (replay.patientId !== input.patientId) throw new HttpError(409, "That request reference was used for a different patient");
        return { id: replay.id, admissionNo: replay.admissionNo, replay: true };
      }
    }
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, tenantId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new HttpError(404, "Patient not found");
    const doctor = await tx.user.findFirst({ where: { id: input.doctorId, tenantId, role: "DOCTOR", isActive: true, deletedAt: null }, select: { id: true } });
    if (!doctor) throw new HttpError(400, "Choose an active doctor of this clinic");

    // One active admission per patient: the advisory lock makes check-then-insert safe against a parallel admit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ":adm-patient:" + input.patientId}))`;
    const active = await tx.admission.findFirst({ where: { tenantId, patientId: input.patientId, status: "ADMITTED", deletedAt: null }, select: { admissionNo: true } });
    if (active) throw new HttpError(409, `This patient is already admitted (${active.admissionNo})`);

    let bed: BedRow | null = null;
    if (input.bedId) {
      bed = await lockBed(tx, tenantId, input.bedId);
      await assertBedFree(tx, bed);
    }

    // Counter last: its row lock is held until commit, so keep everything slow before it.
    const t = await tx.tenant.update({ where: { id: tenantId }, data: { admissionSeq: { increment: 1 } }, select: { admissionSeq: true } });
    const now = new Date();
    const admission = await tx.admission.create({
      data: {
        tenantId, admissionNo: formatAdmissionNo(t.admissionSeq), patientId: input.patientId, doctorId: input.doctorId, bedId: bed?.id ?? null,
        admittedAt: now, reason: input.reason ?? null, diagnosis: input.diagnosis ?? null,
        expectedDischargeAt: input.expectedDischargeAt ? new Date(input.expectedDischargeAt) : null,
        clientRef: input.clientRef ?? null, createdById: input.userId,
      },
      select: { id: true, admissionNo: true },
    });
    if (bed) await tx.bedStay.create({ data: { tenantId, admissionId: admission.id, bedId: bed.id, startedAt: now, rate: paiseToDecimal(toPaise(bed.rate)) } });
    await tx.auditLog.create({ data: { tenantId, actorId: input.userId, action: "CREATE", entity: "Admission", entityId: admission.id } });
    return { ...admission, replay: false };
  }, TX));
}

export async function transfer(args: { tenantId: string; userId: string; admissionId: string; toBedId: string }) {
  const { tenantId, admissionId, toBedId } = args;
  return mapBedRace(prisma.$transaction(async (tx) => {
    // Lock order everywhere: admission row, then beds by id.
    const rows = await tx.$queryRaw<{ status: string; bedId: string | null }[]>`SELECT status::text AS status, "bedId" FROM "Admission" WHERE id = ${admissionId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "Admission not found");
    if (rows[0].status !== "ADMITTED") throw new HttpError(409, "Only a patient who is still admitted can be moved");
    const fromBedId = rows[0].bedId;
    if (fromBedId === toBedId) throw new HttpError(400, "The patient is already in that bed");

    let target: BedRow | null = null;
    for (const id of [fromBedId, toBedId].filter((x): x is string => !!x).sort()) {
      const b = await lockBed(tx, tenantId, id);
      if (id === toBedId) target = b;
    }
    await assertBedFree(tx, target!, admissionId);

    const now = new Date();
    await tx.bedStay.updateMany({ where: { admissionId, endedAt: null }, data: { endedAt: now } });
    await tx.bedStay.create({ data: { tenantId, admissionId, bedId: toBedId, startedAt: now, rate: paiseToDecimal(toPaise(target!.rate)) } });
    await tx.admission.update({ where: { id: admissionId }, data: { bedId: toBedId } });
    await tx.auditLog.create({ data: { tenantId, actorId: args.userId, action: "TRANSFER", entity: "Admission", entityId: admissionId, diff: { from: fromBedId, to: toBedId } } });
    return { id: admissionId, bedId: toBedId };
  }, TX));
}

export async function dischargePatient(args: { tenantId: string; userId: string; admissionId: string; billingOn: boolean; dischargeOn: boolean }) {
  const { tenantId, admissionId } = args;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Admission" WHERE id = ${admissionId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "Admission not found");
    const now = new Date();
    // Compare-and-set: only one of two parallel discharges wins.
    const won = await tx.admission.updateMany({ where: { id: admissionId, tenantId, status: "ADMITTED" }, data: { status: "DISCHARGED", dischargedAt: now } });
    if (won.count === 0) throw new HttpError(409, "This patient is already discharged");
    await tx.bedStay.updateMany({ where: { admissionId, endedAt: null }, data: { endedAt: now } });

    const adm = await tx.admission.findUniqueOrThrow({
      where: { id: admissionId },
      select: { patientId: true, doctorId: true, admissionNo: true, diagnosis: true, reason: true, admittedAt: true },
    });
    const stays = await tx.bedStay.findMany({ where: { admissionId }, orderBy: { startedAt: "asc" }, include: { bed: { select: { label: true, ward: { select: { name: true } } } } } });
    const { lines, totalPaise } = bedCharges(
      stays.map((s) => ({ startedAt: s.startedAt, endedAt: s.endedAt, ratePaise: toPaise(Number(s.rate)), label: `${s.bed.ward.name} / ${s.bed.label}` })),
      now
    );

    let invoice: { id: string; number: string } | null = null;
    if (args.billingOn && totalPaise > 0) {
      invoice = await createInvoiceInTx(tx, {
        tenantId, userId: args.userId, patientId: adm.patientId,
        lines: lines.filter((l) => l.amountPaise > 0).map((l) => ({ description: `Bed charges ${adm.admissionNo}: ${l.label} (${l.days} day${l.days === 1 ? "" : "s"})`, qty: l.days, unitPrice: l.ratePaise / 100, gstPercent: 0 })),
        notes: `Admission ${adm.admissionNo}`,
      });
      await tx.admission.update({ where: { id: admissionId }, data: { invoiceId: invoice.id } });
    }

    if (args.dischargeOn) {
      await tx.dischargeSummary.upsert({
        where: { admissionId },
        update: {},
        create: {
          tenantId, admissionId, patientId: adm.patientId, doctorId: adm.doctorId, status: "DRAFT",
          diagnosis: adm.diagnosis, courseInHospital: adm.reason ? `Admitted for: ${adm.reason}` : null,
        },
      });
    }
    await tx.auditLog.create({ data: { tenantId, actorId: args.userId, action: "DISCHARGE", entity: "Admission", entityId: admissionId, diff: { totalPaise, invoiceId: invoice?.id ?? null } } });
    return { id: admissionId, dischargedAt: now, bedChargesPaise: totalPaise, invoiceId: invoice?.id ?? null, invoiceNumber: invoice?.number ?? null, lines };
  }, TX);
}

/** Lock a bed, run `fn` (e.g. deactivate), all in one transaction so an admit cannot slip in between. */
export async function withBedLocked<T>(tenantId: string, bedId: string, fn: (tx: Tx, bed: BedRow) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => fn(tx, await lockBed(tx, tenantId, bedId)), TX);
}

/**
 * "Bill later": invoices the bed charges of a discharged admission that has no invoice yet (billing was off at
 * discharge, or the invoice was cancelled). Locks the admission so two clicks cannot create two invoices.
 */
export async function billAdmission(args: { tenantId: string; userId: string; admissionId: string }) {
  const { tenantId, admissionId } = args;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: string; invoiceId: string | null }[]>`SELECT status::text AS status, "invoiceId" FROM "Admission" WHERE id = ${admissionId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "Admission not found");
    if (rows[0].status !== "DISCHARGED") throw new HttpError(409, "Bed charges are billed when the patient is discharged");
    if (rows[0].invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: rows[0].invoiceId }, select: { status: true } });
      if (inv && inv.status !== "CANCELLED") throw new HttpError(409, "Bed charges are already invoiced");
    }
    const adm = await tx.admission.findUniqueOrThrow({ where: { id: admissionId }, select: { patientId: true, admissionNo: true, dischargedAt: true } });
    const stays = await tx.bedStay.findMany({ where: { admissionId }, orderBy: { startedAt: "asc" }, include: { bed: { select: { label: true, ward: { select: { name: true } } } } } });
    const { lines, totalPaise } = bedCharges(
      stays.map((s) => ({ startedAt: s.startedAt, endedAt: s.endedAt, ratePaise: toPaise(Number(s.rate)), label: `${s.bed.ward.name} / ${s.bed.label}` })),
      adm.dischargedAt ?? new Date()
    );
    if (totalPaise <= 0) throw new HttpError(409, "There are no bed charges to bill");
    const invoice = await createInvoiceInTx(tx, {
      tenantId, userId: args.userId, patientId: adm.patientId,
      lines: lines.filter((l) => l.amountPaise > 0).map((l) => ({ description: `Bed charges ${adm.admissionNo}: ${l.label} (${l.days} day${l.days === 1 ? "" : "s"})`, qty: l.days, unitPrice: l.ratePaise / 100, gstPercent: 0 })),
      notes: `Admission ${adm.admissionNo}`,
    });
    await tx.admission.update({ where: { id: admissionId }, data: { invoiceId: invoice.id } });
    await tx.auditLog.create({ data: { tenantId, actorId: args.userId, action: "UPDATE", entity: "Admission", entityId: admissionId, diff: { billedLater: true, totalPaise, invoiceId: invoice.id } } });
    return { invoiceId: invoice.id, invoiceNumber: invoice.number, totalPaise };
  }, TX);
}
