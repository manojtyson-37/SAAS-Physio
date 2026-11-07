/**
 * Gives the demo clinics a live-looking "today": an OPD queue (completed + billed, one in consult, some waiting),
 * payments and a few appointments. Run it before a pitch (or daily).
 *
 *   npx tsx scripts/refresh-demo-day.ts                 # dry run
 *   npx tsx scripts/refresh-demo-day.ts --apply         # create today's activity
 *   npx tsx scripts/refresh-demo-day.ts --apply --now=2026-11-09T10:00:00+05:30   # pretend it is another time (testing)
 *
 * It only touches the demo clinics (matched by their admin login) and only creates rows, with one tidy-up:
 * visits left WAITING or IN_CONSULT from an earlier day are marked CANCELLED, exactly as a real front desk
 * closes the previous day's queue. Nothing is deleted. A clinic that already has visits today is skipped,
 * so running it twice in one day is harmless.
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_CLINICS } from "../prisma/demoClinics";
import { CLINIC_TYPES, type ClinicTypeKey } from "../lib/modules/clinicTypes";
import { computeInvoice, formatInvoiceNumber, paiseToDecimal, toPaise } from "../lib/hospital/billing";
import { istDateKey } from "../lib/hospital/dates";
import { calcBmi } from "../lib/hospital/vitals";

const prisma = new PrismaClient();

type Med = { genericName: string; brandName?: string; form: string; strength: string; dose: string; frequency: string; durationDays: number; instructions?: string; route?: string };
type Target = { name: string; adminEmail: string; diagnoses: string[]; advice: string[]; meds: Med[] };

const SUNRISE: Target = {
  name: "Sunrise Physiotherapy & Wellness",
  adminEmail: "admin@sunrisephysio.in",
  diagnoses: ["Lumbar strain", "Rotator cuff tendinopathy", "Post-ACL reconstruction rehab", "Cervical spondylosis", "Plantar fasciitis"],
  advice: ["Continue prescribed home exercises twice daily", "Ice for 15 minutes after activity", "Review in 1 week"],
  meds: [
    { genericName: "Diclofenac", brandName: "Voveran Emulgel", form: "Gel", strength: "1%", dose: "Apply thin layer", frequency: "1-1-1", durationDays: 7, route: "Topical" },
    { genericName: "Paracetamol", brandName: "Dolo", form: "Tablet", strength: "650 mg", dose: "1 tablet", frequency: "SOS", durationDays: 5, instructions: "After food, only if pain" },
  ],
};

const TARGETS: Target[] = [
  SUNRISE,
  ...DEMO_CLINICS.map((c) => ({ name: c.name, adminEmail: c.admin.email, diagnoses: c.diagnoses, advice: c.advice, meds: c.meds })),
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}
const METHODS = ["Cash", "UPI", "Card", "UPI", "Cash"];

async function refresh(t: Target, now: Date, apply: boolean) {
  const admin = await prisma.user.findUnique({ where: { email: t.adminEmail }, select: { tenantId: true } });
  if (!admin?.tenantId) return `${t.name}: not found, skipped`;
  const tenantId = admin.tenantId;

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { clinicType: true, enabledModules: true } });
  const modules = new Set(tenant.enabledModules);
  const preset = CLINIC_TYPES[tenant.clinicType as ClinicTypeKey];
  const todayKey = istDateKey(now);

  if ((await prisma.visit.count({ where: { tenantId, tokenDate: todayKey, deletedAt: null } })) > 0) {
    return `${t.name}: already has activity for ${todayKey}, skipped`;
  }

  const stale = await prisma.visit.count({ where: { tenantId, status: { in: ["WAITING", "IN_CONSULT"] }, tokenDate: { lt: todayKey } } });
  if (!apply) return `${t.name}: would close ${stale} stale open visit(s) and create today's queue (${todayKey})`;

  if (stale) {
    await prisma.visit.updateMany({
      where: { tenantId, status: { in: ["WAITING", "IN_CONSULT"] }, tokenDate: { lt: todayKey } },
      data: { status: "CANCELLED", endedAt: now },
    });
  }

  const rand = rng(Number(todayKey.split("-").join("")) + t.adminEmail.length);
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  const [doctors, reception, services, patientsAll, openNow] = await Promise.all([
    prisma.user.findMany({ where: { tenantId, role: "DOCTOR", isActive: true, deletedAt: null }, select: { id: true } }),
    prisma.user.findFirst({ where: { tenantId, role: "STAFF", isActive: true, deletedAt: null }, select: { id: true } }),
    prisma.serviceItem.findMany({ where: { tenantId, isActive: true } }),
    prisma.patient.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, reason: true } }),
    prisma.visit.findMany({ where: { tenantId, status: { in: ["WAITING", "IN_CONSULT"] }, deletedAt: null }, select: { patientId: true } }),
  ]);
  if (!doctors.length || !reception) return `${t.name}: needs at least one doctor and one reception login, skipped`;

  const busy = new Set(openNow.map((v) => v.patientId));
  const patients = patientsAll.filter((p) => !busy.has(p.id)).sort(() => rand() - 0.5).slice(0, 8);
  let created = "";

  if (modules.has("opd") && patients.length) {
    let token = 0;
    for (let i = 0; i < patients.length; i++) {
      token += 1;
      const p = patients[i];
      const doctorId = doctors[i % doctors.length].id;
      const done = i < 4;
      const inConsult = i === 4;
      const startedAt = new Date(now.getTime() - (done ? 200 - i * 40 : 8) * 60000);
      const visit = await prisma.visit.create({
        data: {
          tenantId, patientId: p.id, doctorId, type: "OPD", tokenDate: todayKey, tokenNumber: token, chiefComplaint: p.reason,
          status: done ? "COMPLETED" : inConsult ? "IN_CONSULT" : "WAITING",
          createdAt: done ? new Date(startedAt.getTime() - between(5, 20) * 60000) : new Date(now.getTime() - (inConsult ? 30 : 25 - i * 3) * 60000),
          ...(done || inConsult ? { startedAt } : {}),
          ...(done ? { endedAt: new Date(startedAt.getTime() + between(8, 22) * 60000), diagnosis: pick(t.diagnoses), advice: pick(t.advice) } : {}),
        },
      });
      if (!done) continue;

      const h = between(150, 182), w = between(52, 88), sys = between(105, 142);
      await prisma.vitals.create({
        data: {
          tenantId, visitId: visit.id, patientId: p.id, recordedById: reception.id, recordedAt: visit.createdAt,
          systolic: sys, diastolic: between(65, Math.min(92, sys - 20)), pulse: between(62, 96), spo2: between(96, 99),
          tempC: (36.4 + rand() * 1.4).toFixed(1), weightKg: w, heightCm: h, bmi: calcBmi(w, h) ?? undefined,
        },
      });
      const rx = await prisma.prescription.create({ data: { tenantId, visitId: visit.id, patientId: p.id, doctorId, createdAt: visit.endedAt! } });
      const meds = t.meds.slice(0, between(1, Math.min(3, t.meds.length)));
      await prisma.prescriptionItem.createMany({ data: meds.map((m, k) => ({ ...m, sortOrder: k, prescriptionId: rx.id })) });

      if (modules.has("billing") && services.length) {
        const chosen = [pick(services), pick(services)].filter((s, k, a) => a.findIndex((x) => x.id === s.id) === k);
        const calc = computeInvoice(chosen.map((s) => ({ description: s.name, qty: 1, unitPrice: Number(s.price), gstPercent: Number(s.gstPercent) })));
        const paidPaise = i === 3 ? Math.floor(calc.totalPaise / 2 / 100) * 100 : calc.totalPaise;
        const seq = (await prisma.tenant.update({ where: { id: tenantId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } })).invoiceSeq;
        const inv = await prisma.invoice.create({
          data: {
            tenantId, patientId: p.id, visitId: visit.id, createdById: reception.id, number: formatInvoiceNumber(seq, now), date: visit.endedAt!,
            subtotal: paiseToDecimal(calc.subtotalPaise), gst: paiseToDecimal(calc.gstPaise), discount: "0.00", total: paiseToDecimal(calc.totalPaise),
            paidAmount: paiseToDecimal(paidPaise), status: paidPaise >= calc.totalPaise ? "PAID" : "PARTIAL",
            lineItems: { create: calc.lines.map((l, k) => ({ sortOrder: k, description: l.description, qty: l.qty, unitPrice: paiseToDecimal(toPaise(l.unitPrice)), gstPercent: l.gstPercent.toFixed(2), lineTotal: paiseToDecimal(l.lineTotalPaise) })) },
          },
        });
        await prisma.payment.create({ data: { invoiceId: inv.id, method: pick(METHODS), amount: paiseToDecimal(paidPaise), date: visit.endedAt!, receivedById: reception.id } });
      }
    }
    created += `${patients.length} OPD visits`;
  }

  if (modules.has("appointments")) {
    const dayStart = new Date(`${todayKey}T00:00:00+05:30`);
    const has = await prisma.appointment.count({ where: { tenantId, deletedAt: null, datetime: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) } } });
    if (!has && patientsAll.length) {
      for (let i = 0; i < 3; i++) {
        await prisma.appointment.create({
          data: {
            tenantId, patientId: pick(patientsAll).id, doctorId: pick(doctors).id, status: "SCHEDULED",
            datetime: new Date(dayStart.getTime() + (15 + i * 2) * 3600000), durationMin: preset?.appointmentMinutes ?? 30,
          },
        });
      }
      created += `${created ? ", " : ""}3 appointments`;
    }
  }
  return `${t.name}: created ${created || "nothing (no modules to fill)"}${stale ? `; closed ${stale} stale open visit(s)` : ""}`;
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@([^/:?]+).*$/, "$1");
  const apply = process.argv.includes("--apply");
  const nowArg = process.argv.find((a) => a.startsWith("--now="))?.slice(6);
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("--now must be a valid date");
  console.log(`Target host: ${host}\nMode: ${apply ? "APPLY" : "dry run (no writes)"}\nDemo day: ${istDateKey(now)}`);
  for (const t of TARGETS) console.log(`- ${await refresh(t, now, apply)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
