import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/hospital/guard";

// Healthcare services by clinical establishments are generally GST-exempt in India, so the starter
// list uses 0%. Clinics can change this per item; confirm treatment with the clinic's accountant.
const STARTER = [
  { name: "Consultation", category: "Consultation", price: "500.00" },
  { name: "Follow-up consultation", category: "Consultation", price: "300.00" },
  { name: "Initial assessment", category: "Consultation", price: "1000.00" },
  { name: "Physiotherapy session", category: "Therapy", price: "800.00" },
  { name: "Ultrasound therapy", category: "Therapy", price: "400.00" },
  { name: "TENS / electrotherapy", category: "Therapy", price: "300.00" },
  { name: "Dry needling", category: "Procedure", price: "600.00" },
  { name: "Kinesio taping", category: "Procedure", price: "250.00" },
  { name: "Home visit", category: "Other", price: "1500.00" },
  { name: "X-ray (per view)", category: "Radiology", price: "400.00" },
];

/** Loads the starter price list, but only into an empty price list; safe to call twice. */
export async function POST() {
  const g = await requireTenantSession(["CLINIC_ADMIN"]);
  if (!g.session) return g.response;

  const existing = await prisma.serviceItem.count({ where: { tenantId: g.tenantId } });
  if (existing > 0) {
    return NextResponse.json({ error: "Your price list already has items" }, { status: 409 });
  }
  const r = await prisma.serviceItem.createMany({
    data: STARTER.map((s) => ({ ...s, tenantId: g.tenantId, gstPercent: "0.00" })),
    skipDuplicates: true,
  });
  return NextResponse.json({ created: r.count }, { status: 201 });
}
