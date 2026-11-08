/**
 * Gives the demo clinics a stocked pharmacy: items matching the medicines their doctors prescribe, batches with
 * a spread of expiry dates (one near expiry, one already expired, one low-stock item) and the matching receipts.
 *
 *   npx tsx scripts/seed-demo-stock.ts            # dry run
 *   npx tsx scripts/seed-demo-stock.ts --apply    # create
 *
 * Only creates rows, plus one additive change per demo clinic: it switches the inventory (and pharmacy) module on.
 * A clinic that already has stock items is skipped, so running it twice changes nothing.
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_CLINICS } from "../prisma/demoClinics";
import { withRequirements } from "../lib/modules/resolve";
import type { ModuleKey } from "../lib/modules/registry";

const prisma = new PrismaClient();

const EXTRA = [
  { genericName: "Cetirizine", brandName: "Okacet", form: "Tablet", strength: "10 mg", price: 3 },
  { genericName: "Pantoprazole", brandName: "Pan 40", form: "Tablet", strength: "40 mg", price: 9 },
  { genericName: "Amoxicillin", brandName: "Mox", form: "Capsule", strength: "500 mg", price: 12 },
  { genericName: "ORS", brandName: "Electral", form: "Sachet", strength: "21.8 g", price: 22 },
  { genericName: "Povidone iodine", brandName: "Betadine", form: "Solution", strength: "5%", price: 85 },
  { genericName: "Surgical gloves", brandName: null, form: "Pair", strength: "Medium", price: 14, category: "Consumable" },
  { genericName: "Disposable syringe", brandName: null, form: "Piece", strength: "5 ml", price: 6, category: "Consumable" },
];

/** Clinic admin login → modules to switch on. Physio and the hospital pitch both get pharmacy; dental only stock. */
const PLAN: Record<string, ModuleKey[]> = {
  "admin@citycare.demo": ["inventory", "pharmacy"],
  "admin@bonewell.demo": ["inventory", "pharmacy"],
  "admin@lakeview.demo": ["inventory", "pharmacy"],
  "admin@brightsmile.demo": ["inventory"],
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}
const dayFromNow = (n: number) => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() + n * 86_400_000;

async function seed(email: string, name: string, meds: { genericName: string; brandName?: string; form: string; strength: string }[], apply: boolean) {
  const admin = await prisma.user.findUnique({ where: { email }, select: { tenantId: true } });
  if (!admin?.tenantId) return `${name}: not found, skipped`;
  const tenantId = admin.tenantId;
  if ((await prisma.stockItem.count({ where: { tenantId } })) > 0) return `${name}: already has stock, skipped`;

  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { enabledModules: true } });
  const modules = withRequirements([...(t.enabledModules as ModuleKey[]), ...PLAN[email]]);
  const seen = new Set<string>();
  const list = [
    ...meds.map((m) => ({ ...m, brandName: m.brandName ?? null, price: 6, category: "Medicine" })),
    ...EXTRA.map((e) => ({ ...e, category: e.category ?? "Medicine" })),
  ].filter((m) => { const k = `${m.genericName}|${m.strength}|${m.form}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  if (!apply) return `${name}: would add ${list.length} items with batches and switch on ${PLAN[email].join(" + ")}`;

  const rand = rng(email.length * 7919);
  const user = await prisma.user.findFirst({ where: { tenantId, role: "STAFF", deletedAt: null }, select: { id: true } });
  const supplier = await prisma.supplier.create({ data: { tenantId, name: "MedPlus Distributors", phone: "080 4000 1234", gstin: "29ABCDE1234F1Z5", address: "Industrial Area, Bengaluru" } });

  let batches = 0;
  for (const [idx, m] of list.entries()) {
    const price = m.price !== 6 ? m.price : Math.round((2 + rand() * 38) * 2) / 2;
    const item = await prisma.stockItem.create({
      data: {
        tenantId, name: m.genericName, brand: m.brandName, form: m.form, strength: m.strength, category: m.category,
        unit: m.form === "Tablet" || m.form === "Capsule" ? "tablet" : m.form.toLowerCase(), gstPercent: m.category === "Medicine" ? "12" : "18", reorderLevel: 40,
      },
    });
    const plan =
      idx === 1 ? [{ exp: 400, qty: 22 }]                         // low stock
      : idx === 2 ? [{ exp: -12, qty: 30 }, { exp: 380, qty: 150 }] // one expired batch alongside good stock
      : idx === 3 ? [{ exp: 45, qty: 60 }, { exp: 420, qty: 200 }]  // near expiry (sold first)
      : [{ exp: 55 + Math.floor(rand() * 60), qty: 40 + Math.floor(rand() * 60) }, { exp: 300 + Math.floor(rand() * 300), qty: 120 + Math.floor(rand() * 200) }];
    for (const [k, p] of plan.entries()) {
      const batch = await prisma.stockBatch.create({
        data: {
          tenantId, itemId: item.id, supplierId: supplier.id, batchNo: `B${String(idx + 1).padStart(2, "0")}${String.fromCharCode(65 + k)}${Math.floor(rand() * 900 + 100)}`,
          expiryDate: new Date(dayFromNow(p.exp)), qtyOnHand: p.qty, costPrice: (price * 0.7).toFixed(2), salePrice: price.toFixed(2),
        },
      });
      await prisma.stockMovement.create({ data: { tenantId, itemId: item.id, batchId: batch.id, type: "RECEIPT", qty: p.qty, note: "Opening stock", createdById: user?.id ?? null } });
      batches++;
    }
  }
  await prisma.tenant.update({ where: { id: tenantId }, data: { enabledModules: modules } });
  return `${name}: created ${list.length} items, ${batches} batches; modules now ${modules.join(", ")}`;
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@([^/:?]+).*$/, "$1");
  const apply = process.argv.includes("--apply");
  console.log(`Target host: ${host}\nMode: ${apply ? "APPLY (additive)" : "dry run (no writes)"}`);
  for (const c of DEMO_CLINICS) {
    if (!PLAN[c.admin.email]) continue;
    console.log(`- ${await seed(c.admin.email, c.name, c.meds, apply)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
