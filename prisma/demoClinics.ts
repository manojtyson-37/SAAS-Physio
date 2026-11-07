/**
 * Demo clinics, one per clinic type, used for pitching.
 *
 * ADDITIVE and IDEMPOTENT: a clinic is only created when its admin login does not exist yet, and nothing
 * is ever updated or deleted. Safe to run against any database, including production.
 * (The wiping seed in prisma/seed.ts is separate and guarded.)
 */
import { PrismaClient, type Patient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CLINIC_TYPES, type ClinicTypeKey } from "../lib/modules/clinicTypes";
import { computeInvoice, formatInvoiceNumber, paiseToDecimal, toPaise } from "../lib/hospital/billing";
import { formatUhid } from "../lib/hospital/uhid";
import { istDateKey } from "../lib/hospital/dates";
import { calcBmi } from "../lib/hospital/vitals";

import { DEMO_PASSWORD } from "../lib/demoAccounts";
export { DEMO_PASSWORD };

type Med = { genericName: string; brandName?: string; form: string; strength: string; dose: string; frequency: string; durationDays: number; instructions?: string; route?: string };

export type DemoClinic = {
  key: string;
  name: string;
  clinicType: ClinicTypeKey;
  city: string;
  address: string;
  phone: string;
  email: string;
  gst: string;
  uhidPrefix: string;
  branches: string[];
  admin: { name: string; email: string };
  doctors: { name: string; email: string; specialty: string }[];
  reception: { name: string; email: string };
  patients: { name: string; gender: "Male" | "Female"; age: number; reason: string }[];
  diagnoses: string[];
  advice: string[];
  meds: Med[];
  packages: { name: string; sessions: number; price: number }[];
};

export const DEMO_CLINICS: DemoClinic[] = [
  {
    key: "dental",
    name: "BrightSmile Dental Studio",
    clinicType: "DENTAL",
    city: "Pune",
    address: "14, Koregaon Park Road, Pune, MH 411001",
    phone: "+91 20 4567 1200",
    email: "hello@brightsmile.demo",
    gst: "27AAACB4567D1Z8",
    uhidPrefix: "BS",
    branches: ["Koregaon Park"],
    admin: { name: "Meera Kulkarni", email: "admin@brightsmile.demo" },
    doctors: [
      { name: "Dr. Aditya Rao", email: "dr.aditya@brightsmile.demo", specialty: "Endodontics" },
      { name: "Dr. Kavita Joshi", email: "dr.kavita@brightsmile.demo", specialty: "Orthodontics" },
      { name: "Dr. Sameer Patil", email: "dr.sameer@brightsmile.demo", specialty: "General Dentistry" },
    ],
    reception: { name: "Pooja Deshmukh", email: "reception@brightsmile.demo" },
    patients: [
      { name: "Rohit Mehta", gender: "Male", age: 34, reason: "Toothache, lower right molar" },
      { name: "Ananya Sharma", gender: "Female", age: 27, reason: "Scaling and polishing" },
      { name: "Vikram Singh", gender: "Male", age: 45, reason: "Root canal follow-up" },
      { name: "Neha Kapoor", gender: "Female", age: 31, reason: "Braces adjustment" },
      { name: "Arjun Nair", gender: "Male", age: 52, reason: "Loose crown" },
      { name: "Priya Iyer", gender: "Female", age: 24, reason: "Teeth whitening consultation" },
      { name: "Sandeep Gupta", gender: "Male", age: 39, reason: "Wisdom tooth pain" },
      { name: "Divya Menon", gender: "Female", age: 29, reason: "Bleeding gums" },
      { name: "Karan Malhotra", gender: "Male", age: 18, reason: "Cavity filling" },
      { name: "Sunita Verma", gender: "Female", age: 58, reason: "Denture fitting" },
      { name: "Aarav Desai", gender: "Male", age: 9, reason: "Paediatric check-up" },
      { name: "Meghna Bose", gender: "Female", age: 36, reason: "Sensitivity to cold" },
      { name: "Faisal Khan", gender: "Male", age: 42, reason: "Tooth extraction" },
      { name: "Ishita Reddy", gender: "Female", age: 26, reason: "Clear aligner enquiry" },
    ],
    diagnoses: ["Dental caries, 46", "Irreversible pulpitis, 36", "Chronic gingivitis", "Impacted 38", "Malocclusion, Class II"],
    advice: ["Avoid very hot or cold food for 24 hours", "Brush twice daily with a soft brush; floss daily", "Review in 7 days"],
    meds: [
      { genericName: "Amoxicillin", brandName: "Mox", form: "Capsule", strength: "500 mg", dose: "1 capsule", frequency: "1-1-1", durationDays: 5, instructions: "After food" },
      { genericName: "Ibuprofen", brandName: "Brufen", form: "Tablet", strength: "400 mg", dose: "1 tablet", frequency: "1-0-1", durationDays: 3, instructions: "After food" },
      { genericName: "Chlorhexidine", brandName: "Hexidine", form: "Mouthwash", strength: "0.2%", dose: "10 ml", frequency: "1-0-1", durationDays: 7, instructions: "Rinse for 30 seconds, do not swallow" },
    ],
    packages: [
      { name: "Orthodontic treatment plan (12 visits)", sessions: 12, price: 45000 },
      { name: "Teeth whitening plan (3 visits)", sessions: 3, price: 15000 },
      { name: "Full-mouth rehabilitation plan (6 visits)", sessions: 6, price: 60000 },
    ],
  },
  {
    key: "general",
    name: "CityCare Family Clinic",
    clinicType: "GENERAL",
    city: "Hyderabad",
    address: "8-2-120, Road No. 12, Banjara Hills, Hyderabad, TS 500034",
    phone: "+91 40 2345 6700",
    email: "hello@citycare.demo",
    gst: "36AAACC1234E1Z2",
    uhidPrefix: "CC",
    branches: ["Banjara Hills"],
    admin: { name: "Farah Siddiqui", email: "admin@citycare.demo" },
    doctors: [
      { name: "Dr. Imran Ali", email: "dr.imran@citycare.demo", specialty: "General Medicine" },
      { name: "Dr. Lakshmi Narayan", email: "dr.lakshmi@citycare.demo", specialty: "Family Medicine" },
      { name: "Dr. Rekha Menon", email: "dr.rekha@citycare.demo", specialty: "Paediatrics" },
    ],
    reception: { name: "Sana Begum", email: "reception@citycare.demo" },
    patients: [
      { name: "Ramesh Babu", gender: "Male", age: 58, reason: "Hypertension follow-up" },
      { name: "Fatima Khan", gender: "Female", age: 41, reason: "Fever and body ache for 3 days" },
      { name: "Suresh Kumar", gender: "Male", age: 63, reason: "Diabetes review" },
      { name: "Anjali Rao", gender: "Female", age: 29, reason: "Cough and cold" },
      { name: "Mohammed Rafi", gender: "Male", age: 47, reason: "Acidity and gastritis" },
      { name: "Kavya Reddy", gender: "Female", age: 35, reason: "Headache and fatigue" },
      { name: "Baby Aryan", gender: "Male", age: 3, reason: "Fever and loose stools" },
      { name: "Sridevi Naidu", gender: "Female", age: 52, reason: "Joint pain" },
      { name: "Prakash Goud", gender: "Male", age: 38, reason: "Skin rash" },
      { name: "Zainab Ahmed", gender: "Female", age: 24, reason: "Menstrual irregularity" },
      { name: "Venkat Rao", gender: "Male", age: 70, reason: "Routine health check-up" },
      { name: "Lata Devi", gender: "Female", age: 66, reason: "Breathlessness on exertion" },
      { name: "Naveen Chary", gender: "Male", age: 31, reason: "Sore throat" },
      { name: "Shabana Parveen", gender: "Female", age: 44, reason: "Thyroid review" },
    ],
    diagnoses: ["Viral fever", "Essential hypertension", "Type 2 diabetes mellitus", "Acute upper respiratory infection", "Gastritis"],
    advice: ["Plenty of fluids and rest", "Low-salt diet; monitor blood pressure at home", "Review in 5 days or earlier if symptoms worsen"],
    meds: [
      { genericName: "Paracetamol", brandName: "Dolo", form: "Tablet", strength: "650 mg", dose: "1 tablet", frequency: "1-1-1", durationDays: 3, instructions: "After food; only if fever" },
      { genericName: "Cetirizine", brandName: "Okacet", form: "Tablet", strength: "10 mg", dose: "1 tablet", frequency: "0-0-1", durationDays: 5 },
      { genericName: "Pantoprazole", brandName: "Pan", form: "Tablet", strength: "40 mg", dose: "1 tablet", frequency: "1-0-0", durationDays: 14, instructions: "Before breakfast" },
      { genericName: "Amlodipine", brandName: "Amlong", form: "Tablet", strength: "5 mg", dose: "1 tablet", frequency: "1-0-0", durationDays: 30 },
    ],
    packages: [{ name: "Annual health check-up", sessions: 1, price: 2999 }],
  },
  {
    key: "ortho",
    name: "BoneWell Ortho & Joint Care",
    clinicType: "ORTHO",
    city: "Chennai",
    address: "22, Cathedral Road, Gopalapuram, Chennai, TN 600086",
    phone: "+91 44 4789 3300",
    email: "hello@bonewell.demo",
    gst: "33AAACB7890F1Z5",
    uhidPrefix: "BW",
    branches: ["Gopalapuram"],
    admin: { name: "Lakshmi Sundaram", email: "admin@bonewell.demo" },
    doctors: [
      { name: "Dr. Suresh Venkatesh", email: "dr.suresh@bonewell.demo", specialty: "Joint Replacement" },
      { name: "Dr. Anand Krishnan", email: "dr.anand@bonewell.demo", specialty: "Sports Injury" },
      { name: "Dr. Priyanka Raman", email: "dr.priyanka@bonewell.demo", specialty: "Spine" },
    ],
    reception: { name: "Divya Lakshmanan", email: "reception@bonewell.demo" },
    patients: [
      { name: "Murugan Selvam", gender: "Male", age: 62, reason: "Knee osteoarthritis, right" },
      { name: "Kamala Devi", gender: "Female", age: 68, reason: "Hip pain on walking" },
      { name: "Arvind Kumar", gender: "Male", age: 28, reason: "ACL tear assessment" },
      { name: "Sangeetha Raj", gender: "Female", age: 45, reason: "Lower back pain" },
      { name: "Rajesh Pillai", gender: "Male", age: 36, reason: "Fracture follow-up, radius" },
      { name: "Meenakshi Iyer", gender: "Female", age: 55, reason: "Frozen shoulder" },
      { name: "Gopal Krishnan", gender: "Male", age: 71, reason: "Post knee replacement review" },
      { name: "Harini Subramani", gender: "Female", age: 22, reason: "Ankle sprain" },
      { name: "Dinesh Babu", gender: "Male", age: 40, reason: "Cervical spondylosis" },
      { name: "Vasanthi Nair", gender: "Female", age: 59, reason: "Osteoporosis review" },
      { name: "Karthik Rajan", gender: "Male", age: 19, reason: "Football injury, knee" },
      { name: "Padma Narayanan", gender: "Female", age: 64, reason: "Heel pain" },
      { name: "Senthil Kumar", gender: "Male", age: 50, reason: "Tennis elbow" },
      { name: "Revathi Anand", gender: "Female", age: 33, reason: "Wrist pain, carpal tunnel" },
    ],
    diagnoses: ["Primary osteoarthritis, knee", "ACL tear, grade 3", "Lumbar disc prolapse L4-L5", "Distal radius fracture, healing", "Adhesive capsulitis"],
    advice: ["Weight-bearing as tolerated with walker", "Ice for 15 minutes, 3 times a day", "Review with X-ray in 2 weeks"],
    meds: [
      { genericName: "Etoricoxib", brandName: "Nucoxia", form: "Tablet", strength: "90 mg", dose: "1 tablet", frequency: "0-0-1", durationDays: 5, instructions: "After food" },
      { genericName: "Diclofenac", brandName: "Voveran Emulgel", form: "Gel", strength: "1%", dose: "Apply thin layer", frequency: "1-1-1", durationDays: 10, route: "Topical" },
      { genericName: "Calcium carbonate + Vitamin D3", brandName: "Shelcal", form: "Tablet", strength: "500 mg / 250 IU", dose: "1 tablet", frequency: "0-1-0", durationDays: 30 },
      { genericName: "Paracetamol", brandName: "Dolo", form: "Tablet", strength: "650 mg", dose: "1 tablet", frequency: "1-1-1", durationDays: 3, instructions: "After food; SOS for pain" },
    ],
    packages: [
      { name: "Post-surgery rehab plan (10 sessions)", sessions: 10, price: 12000 },
      { name: "Knee care plan (6 sessions)", sessions: 6, price: 7200 },
    ],
  },
  {
    key: "hospital",
    name: "Lakeview Multispeciality Hospital",
    clinicType: "HOSPITAL",
    city: "Kochi",
    address: "Marine Drive, Ernakulam, Kochi, KL 682031",
    phone: "+91 484 400 5500",
    email: "hello@lakeview.demo",
    gst: "32AAACL5555G1Z1",
    uhidPrefix: "LV",
    branches: ["Main hospital", "Edappally OPD centre"],
    admin: { name: "Thomas Mathew", email: "admin@lakeview.demo" },
    doctors: [
      { name: "Dr. Anita George", email: "dr.anita@lakeview.demo", specialty: "General Medicine" },
      { name: "Dr. Rajeev Menon", email: "dr.rajeev@lakeview.demo", specialty: "General Surgery" },
      { name: "Dr. Susan Varghese", email: "dr.susan@lakeview.demo", specialty: "Obstetrics & Gynaecology" },
      { name: "Dr. Joseph Kurian", email: "dr.joseph@lakeview.demo", specialty: "Orthopaedics" },
    ],
    reception: { name: "Maya Pillai", email: "reception@lakeview.demo" },
    patients: [
      { name: "Abraham Thomas", gender: "Male", age: 61, reason: "Chest discomfort" },
      { name: "Sosamma George", gender: "Female", age: 67, reason: "Diabetes and hypertension review" },
      { name: "Biju Varghese", gender: "Male", age: 44, reason: "Abdominal pain" },
      { name: "Remya Nair", gender: "Female", age: 28, reason: "Antenatal check-up, 24 weeks" },
      { name: "Sajan Joseph", gender: "Male", age: 53, reason: "Hernia consultation" },
      { name: "Aswathy Menon", gender: "Female", age: 32, reason: "Fever and cough" },
      { name: "Thankachan Paul", gender: "Male", age: 72, reason: "Knee pain" },
      { name: "Shiny Mathew", gender: "Female", age: 39, reason: "Migraine" },
      { name: "Baby Adithya", gender: "Male", age: 5, reason: "Fever, vomiting" },
      { name: "Gireesh Kumar", gender: "Male", age: 47, reason: "Road traffic injury, wrist" },
      { name: "Latha Krishnan", gender: "Female", age: 56, reason: "Gallstones, surgical opinion" },
      { name: "Mathew Kurian", gender: "Male", age: 66, reason: "Post-operative dressing" },
      { name: "Anjana Sudheer", gender: "Female", age: 25, reason: "Irregular periods" },
      { name: "Nizar Ahmed", gender: "Male", age: 35, reason: "Back pain" },
    ],
    diagnoses: ["Acute gastroenteritis", "Essential hypertension", "Type 2 diabetes mellitus", "Antenatal visit, normal progress", "Inguinal hernia, right"],
    advice: ["Oral rehydration; light diet", "Continue regular medication; monitor sugar and BP", "Review in 1 week with reports"],
    meds: [
      { genericName: "Paracetamol", brandName: "Crocin", form: "Tablet", strength: "650 mg", dose: "1 tablet", frequency: "1-1-1", durationDays: 3, instructions: "After food" },
      { genericName: "Ondansetron", brandName: "Emeset", form: "Tablet", strength: "4 mg", dose: "1 tablet", frequency: "1-0-1", durationDays: 2, instructions: "Before food" },
      { genericName: "Metformin", brandName: "Glycomet", form: "Tablet", strength: "500 mg", dose: "1 tablet", frequency: "1-0-1", durationDays: 30, instructions: "After food" },
      { genericName: "Telmisartan", brandName: "Telma", form: "Tablet", strength: "40 mg", dose: "1 tablet", frequency: "1-0-0", durationDays: 30 },
    ],
    packages: [{ name: "Master health check-up", sessions: 1, price: 4999 }],
  },
];

// Small deterministic generator so every run produces the same demo data.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const METHODS = ["Cash", "UPI", "Card", "UPI", "Cash"];

export type SeedResult = { clinic: string; skipped: boolean; note?: string };

export async function seedDemoClinic(prisma: PrismaClient, c: DemoClinic, now = new Date()): Promise<SeedResult> {
  // The admin login is created LAST and doubles as the "this clinic is complete" marker.
  const exists = await prisma.user.findUnique({ where: { email: c.admin.email }, select: { id: true } });
  if (exists) return { clinic: c.name, skipped: true, note: "admin login already exists" };

  // Emails are globally unique. If any other login of this clinic already exists, a previous run died half way:
  // stop before writing anything (never create a second copy, never delete) and tell the operator.
  const taken = await prisma.user.findMany({
    where: { email: { in: [c.reception.email, ...c.doctors.map((d) => d.email)] } },
    select: { email: true, tenantId: true },
  });
  if (taken.length) {
    throw new Error(
      `${c.name}: found logins from an earlier incomplete run (${taken.map((t) => t.email).join(", ")}, clinic ${taken[0].tenantId}). ` +
        `Nothing was written. Inspect that clinic and remove it by hand, then run again.`
    );
  }

  const preset = CLINIC_TYPES[c.clinicType];
  const modules = new Set<string>(preset.defaultModules);
  const on = (m: string) => modules.has(m);
  const rand = rng(c.key.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const daysAgo = (d: number, h = 11) => {
    const x = new Date(now);
    x.setDate(x.getDate() - d);
    x.setHours(h, between(0, 59), 0, 0);
    return x;
  };

  const tenant = await prisma.tenant.create({
    data: {
      name: c.name,
      gstNumber: c.gst,
      phone: c.phone,
      email: c.email,
      address: c.address,
      clinicType: c.clinicType,
      facilityType: preset.facility,
      enabledModules: [...preset.defaultModules],
      uhidPrefix: c.uhidPrefix,
    },
  });

  const branches = await Promise.all(c.branches.map((name) => prisma.branch.create({ data: { tenantId: tenant.id, name, city: c.city } })));
  const branchId = branches[0].id;

  const reception = await prisma.user.create({ data: { tenantId: tenant.id, branchId, name: c.reception.name, email: c.reception.email, passwordHash, role: "STAFF" } });
  const doctors = [];
  for (const d of c.doctors) {
    doctors.push(await prisma.user.create({ data: { tenantId: tenant.id, branchId, name: d.name, email: d.email, passwordHash, role: "DOCTOR", specialty: d.specialty } }));
  }

  const services = on("billing")
    ? await Promise.all(
        preset.starterServices.map((s) => prisma.serviceItem.create({ data: { tenantId: tenant.id, name: s.name, category: s.category, price: s.price, gstPercent: "0.00" } }))
      )
    : [];

  // Patients with UHIDs
  const patients: Patient[] = [];
  let uhidSeq = 0;
  for (const p of c.patients) {
    uhidSeq += 1;
    const dob = new Date(now);
    dob.setFullYear(dob.getFullYear() - p.age);
    patients.push(
      await prisma.patient.create({
        data: {
          tenantId: tenant.id,
          branchId: pick(branches).id,
          name: p.name,
          phone: `9${between(100000000, 899999999)}`,
          gender: p.gender,
          dob,
          reason: p.reason,
          uhid: formatUhid(c.uhidPrefix, uhidSeq),
          leadSource: pick(["DIRECT", "REFERRAL", "GOOGLE", "WALK_IN", "WHATSAPP", "INSTAGRAM"] as const),
          bloodGroup: pick(["O+", "A+", "B+", "AB+", "O-"]),
          createdAt: daysAgo(between(1, 40)),
        },
      })
    );
  }
  await prisma.tenant.update({ where: { id: tenant.id }, data: { uhidSeq } });

  let invoiceSeq = 0;
  async function bill(patientId: string, visitId: string | null, when: Date, paidMode: "paid" | "partial" | "unpaid", rich = false) {
    if (!services.length) return;
    const chosen = [pick(services), ...(rich || rand() < 0.4 ? [pick(services)] : [])].filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i);
    const calc = computeInvoice(chosen.map((s) => ({ description: s.name, qty: 1, unitPrice: Number(s.price), gstPercent: Number(s.gstPercent) })));
    invoiceSeq += 1;
    const paidPaise = paidMode === "paid" ? calc.totalPaise : paidMode === "partial" ? Math.floor(calc.totalPaise / 2 / 100) * 100 : 0;
    const status = paidPaise >= calc.totalPaise ? "PAID" : paidPaise > 0 ? "PARTIAL" : "UNPAID";
    const inv = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        patientId,
        visitId,
        createdById: reception.id,
        number: formatInvoiceNumber(invoiceSeq, when),
        date: when,
        subtotal: paiseToDecimal(calc.subtotalPaise),
        gst: paiseToDecimal(calc.gstPaise),
        discount: "0.00",
        total: paiseToDecimal(calc.totalPaise),
        paidAmount: paiseToDecimal(paidPaise),
        status,
        lineItems: {
          create: calc.lines.map((l, i) => ({
            sortOrder: i,
            description: l.description,
            qty: l.qty,
            unitPrice: paiseToDecimal(toPaise(l.unitPrice)),
            gstPercent: l.gstPercent.toFixed(2),
            lineTotal: paiseToDecimal(l.lineTotalPaise),
          })),
        },
      },
    });
    if (paidPaise > 0) {
      await prisma.payment.create({
        data: { invoiceId: inv.id, method: pick(METHODS), amount: paiseToDecimal(paidPaise), date: when, receivedById: reception.id },
      });
    }
  }

  // ---- OPD visits: past days (completed) and today (a live queue)
  const rxFor = (medCount: number) => {
    const start = between(0, Math.max(0, c.meds.length - medCount));
    return c.meds.slice(start, start + medCount).map((m, i) => ({ ...m, sortOrder: i }));
  };

  async function completedVisit(patientId: string, doctorId: string, day: string, token: number, startedAt: Date, withBill: boolean, billPaid: "paid" | "partial" | "unpaid", rich = false) {
    const patient = patients.find((p) => p.id === patientId)!;
    const endedAt = new Date(startedAt.getTime() + between(8, 25) * 60000);
    const visit = await prisma.visit.create({
      data: {
        tenantId: tenant.id, branchId, patientId, doctorId, type: "OPD", status: "COMPLETED",
        tokenDate: day, tokenNumber: token, chiefComplaint: patient.reason,
        diagnosis: pick(c.diagnoses), advice: pick(c.advice),
        createdAt: new Date(startedAt.getTime() - between(5, 25) * 60000), startedAt, endedAt,
      },
    });
    const h = between(150, 182), w = between(52, 88);
    const sys = between(105, 142);
    await prisma.vitals.create({
      data: {
        tenantId: tenant.id, visitId: visit.id, patientId, recordedById: reception.id, recordedAt: visit.createdAt,
        systolic: sys, diastolic: between(65, Math.min(92, sys - 20)), pulse: between(62, 96), spo2: between(96, 99),
        tempC: (36.4 + rand() * 1.6).toFixed(1), weightKg: w, heightCm: h, bmi: calcBmi(w, h) ?? undefined,
      },
    });
    const rx = await prisma.prescription.create({ data: { tenantId: tenant.id, visitId: visit.id, patientId, doctorId, createdAt: endedAt } });
    await prisma.prescriptionItem.createMany({ data: rxFor(between(1, Math.min(3, c.meds.length))).map((m) => ({ ...m, prescriptionId: rx.id })) });
    if (withBill) await bill(patientId, visit.id, endedAt, billPaid, rich);
  }

  if (on("opd")) {
    // Past 9 days, 3 to 5 consultations a day
    for (let d = 9; d >= 1; d--) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);
      const key = istDateKey(day);
      const count = between(3, 5);
      for (let t = 1; t <= count; t++) {
        const when = daysAgo(d, 9 + t);
        await completedVisit(pick(patients).id, pick(doctors).id, key, t, when, true, pick(["paid", "paid", "paid", "paid", "paid", "paid", "partial", "unpaid"] as const));
      }
    }
    // Today: 4 completed (billed), 1 in consult, 3 waiting
    const todayKey = istDateKey(now);
    const order = [...patients].sort(() => rand() - 0.5).slice(0, 8);
    let token = 0;
    for (let i = 0; i < 4; i++) {
      token += 1;
      await completedVisit(order[i].id, doctors[i % doctors.length].id, todayKey, token, new Date(now.getTime() - (200 - i * 40) * 60000), true, i === 3 ? "partial" : "paid", true);
    }
    token += 1;
    await prisma.visit.create({
      data: {
        tenantId: tenant.id, branchId, patientId: order[4].id, doctorId: doctors[0].id, type: "OPD", status: "IN_CONSULT",
        tokenDate: todayKey, tokenNumber: token, chiefComplaint: order[4].reason,
        createdAt: new Date(now.getTime() - 30 * 60000), startedAt: new Date(now.getTime() - 8 * 60000),
      },
    });
    for (let i = 5; i < 8; i++) {
      token += 1;
      await prisma.visit.create({
        data: {
          tenantId: tenant.id, branchId, patientId: order[i].id, doctorId: doctors[i % doctors.length].id, type: "OPD", status: "WAITING",
          tokenDate: todayKey, tokenNumber: token, chiefComplaint: order[i].reason,
          createdAt: new Date(now.getTime() - (25 - i * 3) * 60000),
        },
      });
    }
  } else if (on("billing")) {
    for (let i = 0; i < 12; i++) await bill(pick(patients).id, null, daysAgo(between(0, 25)), pick(["paid", "paid", "paid", "partial", "unpaid"] as const));
  }

  // A few extra stand-alone invoices spread over the month
  if (on("billing")) {
    for (let i = 0; i < 6; i++) await bill(pick(patients).id, null, daysAgo(between(10, 28)), pick(["paid", "paid", "paid", "partial", "unpaid"] as const));
    await prisma.tenant.update({ where: { id: tenant.id }, data: { invoiceSeq } });
  }

  // ---- Appointments
  if (on("appointments")) {
    for (let i = 0; i < 6; i++) {
      const at = new Date(now);
      at.setDate(at.getDate() + (i < 3 ? 0 : i - 2));
      at.setHours(10 + i, 0, 0, 0);
      await prisma.appointment.create({
        data: { tenantId: tenant.id, branchId, patientId: pick(patients).id, doctorId: pick(doctors).id, datetime: at, durationMin: preset.appointmentMinutes, status: "SCHEDULED" },
      });
    }
    for (let i = 0; i < 5; i++) {
      await prisma.appointment.create({
        data: { tenantId: tenant.id, branchId, patientId: pick(patients).id, doctorId: pick(doctors).id, datetime: daysAgo(between(1, 12), 10 + i), durationMin: preset.appointmentMinutes, status: "COMPLETED" },
      });
    }
  }

  // ---- Treatment packages / plans
  if (on("packages")) {
    for (let i = 0; i < c.packages.length; i++) {
      const pkg = c.packages[i];
      await prisma.package.create({
        data: {
          tenantId: tenant.id, patientId: patients[i].id, name: pkg.name, totalSessions: pkg.sessions,
          usedSessions: Math.min(pkg.sessions - 1, between(1, pkg.sessions)), price: pkg.price, startDate: daysAgo(between(5, 30)),
        },
      });
    }
  }

  await prisma.user.create({ data: { tenantId: tenant.id, branchId, name: c.admin.name, email: c.admin.email, passwordHash, role: "CLINIC_ADMIN" } });

  return { clinic: c.name, skipped: false, note: `${patients.length} patients, ${[...modules].length} modules` };
}
