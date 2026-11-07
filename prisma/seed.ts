import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FIRST_NAMES = ["Aarav", "Divya", "Kavya", "Nikhil", "Pooja", "Rohit", "Vikram", "Meera", "Ishita", "Sneha", "Rahul", "Ananya", "Aditya"];
const LAST_NAMES = ["Rao", "Kulkarni", "Krishnan", "Patel", "Verma", "Sharma", "Bose"];
const REASONS = ["Plantar fasciitis", "Frozen shoulder", "Sports injury", "Lower back pain", "Post-surgery rehab", "Neck stiffness", "Knee pain"];
const LEAD_SOURCES = ["DIRECT", "REFERRAL", "GOOGLE", "FACEBOOK", "WALK_IN", "WHATSAPP", "INSTAGRAM"] as const;
const REFERRAL_DOCTORS = ["Ortho Hospital", "Bengaluru Ortho", "Dr. Kapoor GP", null, null];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function phone() {
  return `+91${randInt(9000000000, 9999999999)}`;
}

/**
 * This seed WIPES every table before inserting demo data. It once destroyed real
 * patient data (2026-10-27), so it refuses to run unless the operator confirms the
 * exact target host: SEED_CONFIRM_WIPE=<db host> npm run seed
 */
async function guardWipe() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://missing").hostname;
  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    patients: await prisma.patient.count(),
    appointments: await prisma.appointment.count(),
    invoices: await prisma.invoice.count(),
    visits: await prisma.visit.count(),
    vitals: await prisma.vitals.count(),
    prescriptions: await prisma.prescription.count(),
    serviceItems: await prisma.serviceItem.count(),
    payments: await prisma.payment.count(),
  };
  console.log(`Seed target host: ${host}`);
  console.log(`Rows that will be DELETED: ${JSON.stringify(counts)}`);
  if (process.env.SEED_CONFIRM_WIPE !== host) {
    console.error(`ABORTED: set SEED_CONFIRM_WIPE=${host} to confirm you intend to wipe this database.`);
    process.exit(1);
  }
}

async function main() {
  console.log("Seeding PhysioCare demo clinic…");
  await guardWipe();

  await prisma.auditLog.deleteMany();
  // Hospital tables first: their FKs to Patient/User/Tenant are RESTRICT.
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.vitals.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.package.deleteMany();
  await prisma.serviceItem.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.tenant.deleteMany();

  const passwordHash = await bcrypt.hash("Admin@123", 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: "Sunrise Physiotherapy & Wellness",
      gstNumber: "27AABCS1234M1Z5",
      phone: "+91 80 4567 8900",
      email: "hello@sunrisephysio.in",
      address: "12/A, MG Road, Bengaluru, KA 560001",
    },
  });

  const [indiranagar, koramangala] = await Promise.all([
    prisma.branch.create({ data: { tenantId: tenant.id, name: "Indiranagar", city: "Bengaluru" } }),
    prisma.branch.create({ data: { tenantId: tenant.id, name: "Koramangala", city: "Bengaluru" } }),
  ]);

  await prisma.user.create({
    data: {
      tenantId: null,
      name: "Platform Super Admin",
      email: "superadmin@physiocare.io",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  const clinicAdmin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: "Priya Menon",
      email: "admin@sunrisephysio.in",
      passwordHash,
      role: "CLINIC_ADMIN",
      title: "Clinic Head",
    },
  });

  const doctorDefs = [
    { name: "Dr. Arjun Iyer", email: "dr.arjun@sunrisephysio.in", specialty: "Sports Physiotherapy" },
    { name: "Dr. Neha Shah", email: "dr.neha@sunrisephysio.in", specialty: "Musculoskeletal" },
    { name: "Dr. Rohan Kapoor", email: "dr.rohan@sunrisephysio.in", specialty: "Neuro Rehabilitation" },
    { name: "Dr. Sara D'Souza", email: "dr.sara@sunrisephysio.in", specialty: "Paediatric Physiotherapy" },
  ];
  const doctors = [];
  for (const d of doctorDefs) {
    doctors.push(
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          branchId: indiranagar.id,
          name: d.name,
          email: d.email,
          passwordHash,
          role: "DOCTOR",
          specialty: d.specialty,
          title: "Senior Physiotherapist",
        },
      })
    );
  }

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      branchId: koramangala.id,
      name: "Kavya Reddy",
      email: "reception@sunrisephysio.in",
      passwordHash,
      role: "STAFF",
      title: "Front Desk",
    },
  });

  const branches = [indiranagar, koramangala];
  const patients = [];
  for (let i = 0; i < 26; i++) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const createdAt = daysAgo(randInt(0, 90));
    const patient = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        branchId: pick(branches).id,
        name,
        phone: phone(),
        gender: pick(["male", "female"]),
        address: "Bengaluru, KA",
        reason: pick(REASONS),
        leadSource: pick(LEAD_SOURCES),
        referralDoctor: pick(REFERRAL_DOCTORS) ?? undefined,
        createdAt,
      },
    });
    patients.push(patient);
  }

  let invoiceSeq = 1;
  for (const patient of patients) {
    const sessions = randInt(4, 12);
    const price = sessions * 800;
    await prisma.package.create({
      data: {
        tenantId: tenant.id,
        patientId: patient.id,
        name: `${sessions} Session Package`,
        totalSessions: sessions,
        usedSessions: randInt(0, sessions),
        price,
        startDate: patient.createdAt,
        endDate: daysAgo(-60),
      },
    });

    const apptCount = randInt(1, 4);
    for (let i = 0; i < apptCount; i++) {
      const doctor = pick(doctors);
      const datetime = daysAgo(randInt(0, 45));
      await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          branchId: patient.branchId,
          patientId: patient.id,
          doctorId: doctor.id,
          datetime,
          durationMin: pick([30, 45, 60]),
          status: "COMPLETED",
        },
      });
    }

    if (Math.random() > 0.15) {
      const qty = randInt(1, 15);
      const unitPrice = 800;
      const gstPercent = 18;
      const subtotal = qty * unitPrice;
      const gst = Math.round(subtotal * (gstPercent / 100));
      const total = subtotal + gst;
      const paidRatio = pick([0, 0.5, 1, 1, 1]);
      const paidAmount = Math.round(total * paidRatio);
      const status = paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";

      const invoice = await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          patientId: patient.id,
          number: `INV-2026-${String(invoiceSeq++).padStart(5, "0")}`,
          date: daysAgo(randInt(0, 40)),
          subtotal,
          gst,
          total,
          paidAmount,
          status,
          lineItems: {
            create: [{ description: "Consultation", qty, unitPrice, gstPercent, lineTotal: total }],
          },
        },
      });

      if (paidAmount > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            method: pick(["Cash", "UPI", "Card", "Netbanking"]),
            amount: paidAmount,
            date: invoice.date,
          },
        });
      }
    }
  }

  // The app allocates invoice numbers from this counter; start it after the seeded ones.
  await prisma.tenant.update({ where: { id: tenant.id }, data: { invoiceSeq: invoiceSeq - 1 } });

  // Demo price list (GST 0%: healthcare services are generally exempt; editable per item).
  await prisma.serviceItem.createMany({
    data: [
      { name: "Consultation", category: "Consultation", price: "500.00" },
      { name: "Follow-up consultation", category: "Consultation", price: "300.00" },
      { name: "Physiotherapy session", category: "Therapy", price: "800.00" },
      { name: "Ultrasound therapy", category: "Therapy", price: "400.00" },
      { name: "Dry needling", category: "Procedure", price: "600.00" },
    ].map((x) => ({ ...x, tenantId: tenant.id, gstPercent: "0.00" })),
  });

  // Attendance for today
  const allStaff = await prisma.user.findMany({ where: { tenantId: tenant.id, isActive: true } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.attendanceRecord.create({
    data: { tenantId: tenant.id, date: today, subject: "STAFF", userId: clinicAdmin.id, status: "PRESENT" },
  });
  await prisma.attendanceRecord.create({
    data: { tenantId: tenant.id, date: today, subject: "STAFF", userId: doctors[0].id, status: "PRESENT" },
  });

  // Marketing campaigns
  await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "Free Back Pain Workshop",
      type: "WORKSHOP",
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-01-15"),
      cost: 8000,
      leads: 45,
      conversions: 18,
      revenue: 92000,
    },
  });
  await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "Instagram Awareness Q1",
      type: "CAMPAIGN",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      cost: 25000,
      leads: 120,
      conversions: 34,
      revenue: 185000,
    },
  });
  await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "Google Ads - Sports Injury",
      type: "CAMPAIGN",
      startDate: new Date("2025-12-01"),
      endDate: new Date("2026-02-28"),
      cost: 45000,
      leads: 210,
      conversions: 62,
      revenue: 340000,
    },
  });

  const referrerNames = ["Bengaluru Ortho", "Fitness First Gym", "Dr. Kapoor GP", "Yoga Studio ZenLife"];
  for (let i = 0; i < 6; i++) {
    await prisma.referral.create({
      data: {
        tenantId: tenant.id,
        referrerName: pick(referrerNames),
        type: pick(["DOCTOR", "OTHER"]),
        revenueGenerated: randInt(5, 40) * 1000,
        date: daysAgo(randInt(0, 20)),
      },
    });
  }

  // Doctor ratings
  const patientDims = ["punctuality", "attentionToDetail", "understanding", "communication", "overallExperience"];
  const deptDims = ["clinicalSkills", "documentation", "knowledge", "caseManagement"];
  for (const doctor of doctors) {
    for (let i = 0; i < randInt(5, 9); i++) {
      const scores: Record<string, number> = {};
      for (const dim of patientDims) scores[dim] = randInt(3, 5);
      await prisma.rating.create({
        data: {
          tenantId: tenant.id,
          doctorId: doctor.id,
          type: "PATIENT",
          scores,
          date: daysAgo(randInt(0, 30)),
        },
      });
    }
    for (let i = 0; i < randInt(1, 3); i++) {
      const scores: Record<string, number> = {};
      for (const dim of deptDims) scores[dim] = randInt(4, 5);
      await prisma.rating.create({
        data: {
          tenantId: tenant.id,
          doctorId: doctor.id,
          type: "DEPT_HEAD",
          scores,
          comment: pick(["Consistent performance", "Great with documentation", "Keep it up", null]) ?? undefined,
          date: daysAgo(randInt(0, 30)),
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("Demo logins (password Admin@123):");
  console.log("  superadmin@physiocare.io");
  console.log("  admin@sunrisephysio.in");
  console.log("  dr.arjun@sunrisephysio.in");
  console.log("  reception@sunrisephysio.in");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
