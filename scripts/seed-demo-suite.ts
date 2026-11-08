/**
 * Fills the demo clinics with believable data for the clinical-suite modules: lab orders with flagged results,
 * imaging reports, a bed board with admitted patients and discharge summaries, a dental chart with treatment plans,
 * and exercise plans with progress. Also switches the modules on for the demo clinics.
 *
 *   npx tsx scripts/seed-demo-suite.ts            # dry run
 *   npx tsx scripts/seed-demo-suite.ts --apply    # create
 *
 * Only creates rows (plus an additive change to each demo clinic's module list). Each section is skipped when that
 * clinic already has data of that kind, so running it twice changes nothing.
 */
import { PrismaClient } from "@prisma/client";
import { withRequirements } from "../lib/modules/resolve";
import type { ModuleKey } from "../lib/modules/registry";
import { STARTER_TESTS } from "../lib/lab/starterTests";
import { STARTER_TYPES } from "../lib/radiology/starterTypes";
import { STARTER_TEMPLATES } from "../lib/exercise/starterTemplates";
import { effectiveFlag, formatLabOrderNo } from "../lib/lab/logic";
import { formatImagingOrderNo } from "../lib/radiology/logic";
import { formatAdmissionNo } from "../lib/ipd/rules";

const prisma = new PrismaClient();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const PLAN: Record<string, ModuleKey[]> = {
  "admin@lakeview.demo": ["lab", "radiology", "ipd", "discharge"],
  "admin@citycare.demo": ["lab"],
  "admin@bonewell.demo": ["radiology", "exercise_plans"],
  "admin@brightsmile.demo": ["dental_chart"],
  "admin@sunrisephysio.in": ["exercise_plans"],
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

type Ctx = { tenantId: string; rand: () => number; patients: { id: string; name: string }[]; doctors: { id: string; name: string }[]; staffId: string | null; apply: boolean; log: string[] };
const pick = <T,>(c: Ctx, xs: T[]) => xs[Math.floor(c.rand() * xs.length)];

async function seedLab(c: Ctx) {
  if ((await prisma.labTest.count({ where: { tenantId: c.tenantId } })) > 0) return c.log.push("lab: has data, skipped");
  if (!c.apply) return c.log.push(`lab: would add ${STARTER_TESTS.length} tests and 4 orders`);
  const tests = [];
  for (const t of STARTER_TESTS) {
    tests.push(await prisma.labTest.create({
      data: { tenantId: c.tenantId, name: t.name, category: t.category, sampleType: t.sampleType, unit: t.unit ?? null, refLow: t.refLow ?? null, refHigh: t.refHigh ?? null, refText: t.refText ?? null, price: t.price.toFixed(2), gstPercent: "0" },
    }));
  }
  const numeric = tests.filter((t) => t.refLow !== null || t.refHigh !== null);
  const states = ["RESULTED", "RESULTED", "COLLECTED", "ORDERED"] as const;
  for (const [i, status] of states.entries()) {
    const chosen = [...numeric].sort(() => c.rand() - 0.5).slice(0, 3 + (i % 2));
    const seq = (await prisma.tenant.update({ where: { id: c.tenantId }, data: { labSeq: { increment: 1 } }, select: { labSeq: true } })).labSeq;
    const at = new Date(Date.now() - (i * 5 + 1) * HOUR);
    await prisma.labOrder.create({
      data: {
        tenantId: c.tenantId, orderNo: formatLabOrderNo(seq), patientId: c.patients[i % c.patients.length].id, orderedById: c.doctors[0]?.id ?? null,
        status, clinicalNotes: i === 0 ? "Fatigue, review of diabetes control" : null, createdAt: at,
        collectedAt: status !== "ORDERED" ? new Date(at.getTime() + 0.5 * HOUR) : null, resultedAt: status === "RESULTED" ? new Date(at.getTime() + 2 * HOUR) : null,
        items: {
          create: chosen.map((t, k) => {
            const lo = Number(t.refLow ?? 0), hi = Number(t.refHigh ?? lo * 2 + 1);
            const mid = (lo + hi) / 2;
            const value = k === 0 && i === 0 ? hi * 1.18 : mid + (c.rand() - 0.5) * (hi - lo) * 0.5; // one clearly high result in the first order
            const text = Number(value.toFixed(t.unit === "%" || hi < 20 ? 1 : 0)).toString();
            const resulted = status === "RESULTED";
            return {
              testId: t.id, testName: t.name, unit: t.unit, refLow: t.refLow, refHigh: t.refHigh, refText: t.refText, price: t.price, gstPercent: t.gstPercent, sortOrder: k,
              ...(resulted ? { resultValue: text, resultNumeric: text, flag: effectiveFlag(text, t.refLow === null ? null : Number(t.refLow), t.refHigh === null ? null : Number(t.refHigh)), resultedAt: new Date(at.getTime() + 2 * HOUR), resultedById: c.staffId } : {}),
            };
          }),
        },
      },
    });
  }
  c.log.push(`lab: ${tests.length} tests, 4 orders`);
}

async function seedRadiology(c: Ctx) {
  if ((await prisma.imagingStudyType.count({ where: { tenantId: c.tenantId } })) > 0) return c.log.push("radiology: has data, skipped");
  if (!c.apply) return c.log.push(`radiology: would add ${STARTER_TYPES.length} study types and 3 orders`);
  const types = [];
  for (const t of STARTER_TYPES) types.push(await prisma.imagingStudyType.create({ data: { tenantId: c.tenantId, modality: t.modality, name: t.name, bodyPart: t.bodyPart, price: t.price.toFixed(2), gstPercent: "0" } }));
  const reportText = [
    { f: "No acute bony injury. Joint spaces are preserved. Mild marginal osteophytes.", i: "No fracture. Early degenerative changes." },
    { f: "Normal cardiac silhouette. Lung fields are clear. No pleural effusion.", i: "Normal chest radiograph." },
  ];
  const states = ["REPORTED", "SCHEDULED", "ORDERED"] as const;
  for (const [i, status] of states.entries()) {
    const t = types[(i * 3) % types.length];
    const seq = (await prisma.tenant.update({ where: { id: c.tenantId }, data: { imagingSeq: { increment: 1 } }, select: { imagingSeq: true } })).imagingSeq;
    const at = new Date(Date.now() - (i * 4 + 2) * HOUR);
    const rep = reportText[i % reportText.length];
    await prisma.imagingOrder.create({
      data: {
        tenantId: c.tenantId, orderNo: formatImagingOrderNo(seq), patientId: c.patients[(i + 1) % c.patients.length].id, studyTypeId: t.id, studyName: t.name, modality: t.modality, bodyPart: t.bodyPart,
        price: t.price, gstPercent: t.gstPercent, clinicalInfo: "Pain and restricted movement, rule out structural cause", status, orderedById: c.doctors[0]?.id ?? null, createdAt: at,
        scheduledAt: status !== "ORDERED" ? new Date(at.getTime() + 1 * HOUR) : null,
        ...(status === "REPORTED" ? { performedAt: new Date(at.getTime() + 1.5 * HOUR), performedById: c.staffId, findings: rep.f, impression: rep.i, reportedAt: new Date(at.getTime() + 3 * HOUR), reportedById: c.doctors[0]?.id ?? null } : {}),
      },
    });
  }
  c.log.push(`radiology: ${types.length} study types, 3 orders`);
}

async function seedIpd(c: Ctx, discharge: boolean) {
  if ((await prisma.ward.count({ where: { tenantId: c.tenantId } })) > 0) return c.log.push("ipd: has data, skipped");
  if (c.patients.length < 6 || c.doctors.length < 1) return c.log.push("ipd: needs 6 patients and a doctor, skipped");
  if (!c.apply) return c.log.push("ipd: would add 3 wards, 14 beds, 4 admitted + 2 discharged patients");
  const layout = [
    { name: "General Ward", type: "GENERAL" as const, beds: 6, rate: 1200 },
    { name: "Private Ward", type: "PRIVATE" as const, beds: 4, rate: 3500 },
    { name: "ICU", type: "ICU" as const, beds: 4, rate: 7500 },
  ];
  const beds: { id: string; ward: string; rate: number }[] = [];
  for (const w of layout) {
    const ward = await prisma.ward.create({ data: { tenantId: c.tenantId, name: w.name, type: w.type } });
    for (let n = 1; n <= w.beds; n++) {
      const b = await prisma.bed.create({ data: { tenantId: c.tenantId, wardId: ward.id, label: `${w.name === "ICU" ? "ICU" : w.name[0]}-${String(n).padStart(2, "0")}`, dailyRate: w.rate.toFixed(2) } });
      beds.push({ id: b.id, ward: w.name, rate: w.rate });
    }
  }
  const bedIn = (ward: string, n: number) => beds.filter((b) => b.ward === ward)[n];
  const plan = [
    { bed: bedIn("General Ward", 0), days: 3, dx: "Community acquired pneumonia", reason: "Fever and breathlessness", status: "ADMITTED" as const },
    { bed: bedIn("General Ward", 2), days: 1, dx: "Acute gastroenteritis with dehydration", reason: "Vomiting and loose stools", status: "ADMITTED" as const },
    { bed: bedIn("Private Ward", 1), days: 2, dx: "Fracture neck of femur, post-op day 1", reason: "Fall at home", status: "ADMITTED" as const },
    { bed: bedIn("ICU", 0), days: 1, dx: "Acute coronary syndrome", reason: "Chest pain", status: "ADMITTED" as const },
    { bed: bedIn("General Ward", 4), days: 4, dx: "Dengue fever", reason: "High fever, low platelets", status: "DISCHARGED" as const, final: true },
    { bed: bedIn("General Ward", 5), days: 2, dx: "Acute appendicitis, appendicectomy", reason: "Right iliac fossa pain", status: "DISCHARGED" as const, final: false },
  ];
  for (const [i, a] of plan.entries()) {
    const seq = (await prisma.tenant.update({ where: { id: c.tenantId }, data: { admissionSeq: { increment: 1 } }, select: { admissionSeq: true } })).admissionSeq;
    const admittedAt = new Date(Date.now() - a.days * DAY - 2 * HOUR);
    const dischargedAt = a.status === "DISCHARGED" ? new Date(Date.now() - (a.days === 4 ? 0.3 : 0.6) * DAY) : null;
    const doctor = c.doctors[i % c.doctors.length];
    const adm = await prisma.admission.create({
      data: {
        tenantId: c.tenantId, admissionNo: formatAdmissionNo(seq), patientId: c.patients[i].id, doctorId: doctor.id, bedId: a.status === "ADMITTED" ? a.bed.id : null, status: a.status,
        admittedAt, dischargedAt, reason: a.reason, diagnosis: a.dx, expectedDischargeAt: a.status === "ADMITTED" ? new Date(Date.now() + 2 * DAY) : null, createdById: c.staffId,
      },
    });
    await prisma.bedStay.create({ data: { tenantId: c.tenantId, admissionId: adm.id, bedId: a.bed.id, startedAt: admittedAt, endedAt: dischargedAt, rate: a.bed.rate.toFixed(2) } });
    const icu = a.bed.ward === "ICU";
    for (let k = 0; k < 4; k++) {
      await prisma.chartEntry.create({
        data: {
          tenantId: c.tenantId, admissionId: adm.id, kind: icu ? "ICU" : "NURSING", recordedAt: new Date(admittedAt.getTime() + (k + 1) * 4 * HOUR), recordedById: c.staffId,
          systolic: 110 + Math.floor(c.rand() * 30), diastolic: 68 + Math.floor(c.rand() * 16), pulse: 70 + Math.floor(c.rand() * 30), respRate: 16 + Math.floor(c.rand() * 6), spo2: 94 + Math.floor(c.rand() * 5),
          tempC: (36.6 + c.rand() * 1.6).toFixed(1), ...(icu ? { gcs: 14 + (k % 2), intakeMl: 250 + k * 50, outputMl: 200 + k * 40 } : {}), notes: k === 0 ? "Admitted, settled in bed. Orders reviewed." : k === 3 ? "Stable, comfortable. Vitals charted." : null,
        },
      });
    }
    if (discharge && a.status === "DISCHARGED") {
      await prisma.dischargeSummary.create({
        data: {
          tenantId: c.tenantId, admissionId: adm.id, patientId: c.patients[i].id, doctorId: doctor.id, status: a.final ? "FINAL" : "DRAFT", diagnosis: a.dx,
          courseInHospital: `Admitted with ${a.reason.toLowerCase()}. Investigated, treated and monitored. Improved steadily and is clinically stable for discharge.`,
          conditionAtDischarge: "Stable, afebrile, ambulant", medicationsOnDischarge: "Tab Paracetamol 650 mg 1-1-1 x 3 days\nTab Pantoprazole 40 mg 1-0-0 x 5 days",
          adviceFollowUp: "Plenty of oral fluids and rest. Return immediately for fever, breathlessness or worsening pain.", followUpDate: new Date(Date.now() + 7 * DAY),
          ...(a.final ? { finalizedAt: dischargedAt, finalizedById: doctor.id } : {}),
        },
      });
    }
  }
  c.log.push(`ipd: 3 wards, ${beds.length} beds, 6 admissions`);
}

async function seedDental(c: Ctx) {
  if ((await prisma.treatmentPlan.count({ where: { tenantId: c.tenantId } })) > 0 || (await prisma.toothRecord.count({ where: { tenantId: c.tenantId } })) > 0) return c.log.push("dental: has data, skipped");
  if (!c.apply) return c.log.push("dental: would add chart findings and 3 treatment plans");
  const findings: [number, string, string | null][] = [[16, "CARIES", "O"], [26, "FILLED", "MO"], [36, "ROOT_CANAL", null], [46, "CROWN", null], [18, "MISSING", null], [11, "HEALTHY", null], [24, "CARIES", "D"]];
  for (const [pi, p] of c.patients.slice(0, 3).entries()) {
    for (const [tooth, condition, surfaces] of findings.slice(pi, pi + 4)) {
      await prisma.toothRecord.create({ data: { tenantId: c.tenantId, patientId: p.id, tooth, condition, surfaces, recordedById: c.doctors[0]?.id ?? null, notes: condition === "CARIES" ? "Deep caries, sensitive to cold" : null } });
    }
  }
  const plans = [
    { title: "Root canal and crown, lower right", status: "IN_PROGRESS" as const, items: [[46, "Root canal treatment", 6500, "DONE"], [46, "Zirconia crown", 9000, "PLANNED"]] },
    { title: "Restorative: upper quadrant", status: "ACCEPTED" as const, items: [[16, "Composite filling", 1800, "PLANNED"], [24, "Composite filling", 1500, "PLANNED"]] },
    { title: "Scaling and polishing", status: "COMPLETED" as const, items: [[null, "Full-mouth scaling and polishing", 1200, "DONE"]] },
  ];
  for (const [i, pl] of plans.entries()) {
    await prisma.treatmentPlan.create({
      data: {
        tenantId: c.tenantId, patientId: c.patients[i].id, title: pl.title, status: pl.status, createdById: c.doctors[0]?.id ?? null,
        items: { create: pl.items.map(([tooth, procedure, price, st], k) => ({ tooth: tooth as number | null, procedure: procedure as string, price: (price as number).toFixed(2), status: st as "DONE" | "PLANNED", doneAt: st === "DONE" ? new Date(Date.now() - 2 * DAY) : null, sortOrder: k })) },
      },
    });
  }
  c.log.push("dental: chart findings for 3 patients, 3 plans");
}

async function seedExercise(c: Ctx) {
  if ((await prisma.exerciseTemplate.count({ where: { tenantId: c.tenantId } })) > 0) return c.log.push("exercise: has data, skipped");
  if (!c.apply) return c.log.push(`exercise: would add ${STARTER_TEMPLATES.length} templates and 3 plans with progress`);
  const templates = [];
  for (const t of STARTER_TEMPLATES) templates.push(await prisma.exerciseTemplate.create({ data: { tenantId: c.tenantId, name: t.name, category: t.category, description: t.description, sets: t.sets, reps: t.reps, holdSeconds: t.holdSeconds, instructions: t.instructions } }));
  const titles = ["Lower back rehab, phase 1", "Post-ACL strengthening", "Neck and shoulder mobility"];
  for (const [i, title] of titles.entries()) {
    const start = new Date(Date.now() - (21 - i * 5) * DAY);
    const plan = await prisma.exercisePlan.create({
      data: {
        tenantId: c.tenantId, patientId: c.patients[i].id, doctorId: c.doctors[0]?.id ?? null, title, startDate: start, status: "ACTIVE", notes: "Do the programme daily; stop and call if pain exceeds 7/10.",
        items: { create: templates.slice(i * 3, i * 3 + 4).map((t, k) => ({ templateId: t.id, name: t.name, sets: t.sets, reps: t.reps, holdSeconds: t.holdSeconds, frequency: k % 2 ? "once daily" : "twice daily", instructions: t.instructions, sortOrder: k })) },
      },
    });
    for (let w = 0; w < 4; w++) {
      await prisma.exerciseProgress.create({ data: { tenantId: c.tenantId, planId: plan.id, patientId: c.patients[i].id, recordedAt: new Date(start.getTime() + (w * 5 + 3) * DAY), painScore: Math.max(1, 7 - w - (i % 2)), adherencePercent: 55 + w * 12, recordedById: c.doctors[0]?.id ?? null, notes: w === 3 ? "Good progress, increase load next week" : null } });
    }
  }
  c.log.push(`exercise: ${templates.length} templates, 3 plans with progress`);
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@([^/:?]+).*$/, "$1");
  const apply = process.argv.includes("--apply");
  console.log(`Target host: ${host}\nMode: ${apply ? "APPLY (additive)" : "dry run (no writes)"}`);
  for (const [email, mods] of Object.entries(PLAN)) {
    const admin = await prisma.user.findUnique({ where: { email }, select: { tenantId: true } });
    if (!admin?.tenantId) { console.log(`- ${email}: not found, skipped`); continue; }
    const tenantId = admin.tenantId;
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, enabledModules: true } });
    const [patients, doctors, staff] = await Promise.all([
      prisma.patient.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: "asc" }, take: 12 }),
      prisma.user.findMany({ where: { tenantId, role: "DOCTOR", isActive: true, deletedAt: null }, select: { id: true, name: true } }),
      prisma.user.findFirst({ where: { tenantId, role: "STAFF", isActive: true, deletedAt: null }, select: { id: true } }),
    ]);
    const c: Ctx = { tenantId, rand: rng(email.length * 104729), patients, doctors, staffId: staff?.id ?? null, apply, log: [] };
    if (patients.length < 4) { console.log(`- ${tenant.name}: needs at least 4 patients, skipped`); continue; }
    if (mods.includes("lab")) await seedLab(c);
    if (mods.includes("radiology")) await seedRadiology(c);
    if (mods.includes("ipd")) await seedIpd(c, mods.includes("discharge"));
    if (mods.includes("dental_chart")) await seedDental(c);
    if (mods.includes("exercise_plans")) await seedExercise(c);
    const next = withRequirements([...(tenant.enabledModules as ModuleKey[]), ...mods]);
    if (apply) await prisma.tenant.update({ where: { id: tenantId }, data: { enabledModules: next } });
    console.log(`- ${tenant.name}: ${c.log.join("; ")}; modules ${apply ? "now" : "would be"}: ${next.join(", ")}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
