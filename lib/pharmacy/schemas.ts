import { z } from "zod";
import { isValidDayKey } from "@/lib/hospital/dates";

const money = z.coerce.number().finite();
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const STOCK_CATEGORIES = ["Medicine", "Consumable", "Dental material", "Implant / ortho", "Other"] as const;

export const stockItemSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  brand: optText(120),
  form: optText(40),
  strength: optText(40),
  unit: z.string().trim().min(1).max(20).default("unit"),
  category: z.enum(STOCK_CATEGORIES).default("Medicine"),
  hsn: optText(12),
  gstPercent: money.min(0).max(28).default(0),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
/** Edits change only the fields sent; the create-time defaults must not be re-applied (that would reset GST, unit, ...). */
export const updateStockItemSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120).optional(),
  brand: z.string().trim().max(120).nullish(),
  form: z.string().trim().max(40).nullish(),
  strength: z.string().trim().max(40).nullish(),
  unit: z.string().trim().min(1).max(20).optional(),
  category: z.enum(STOCK_CATEGORIES).optional(),
  hsn: z.string().trim().max(12).nullish(),
  gstPercent: money.min(0).max(28).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
});

const dayKey = z.string().refine(isValidDayKey, "Expiry must be a real date (YYYY-MM-DD)");

export const receiveSchema = z.object({
  itemId: z.string().min(1),
  batchNo: z.string().trim().min(1, "Batch number is required").max(40),
  expiryDate: dayKey.optional(),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1").max(1_000_000),
  costPrice: money.min(0).max(10_00_000).optional(),
  salePrice: money.gt(0, "Selling price must be more than zero").max(10_00_000),
  supplierId: z.string().min(1).optional(),
  note: optText(200),
});

export const adjustSchema = z.object({
  batchId: z.string().min(1),
  /** Positive adds stock (count correction), negative removes it. */
  delta: z.coerce.number().int().refine((n) => n !== 0, "Change cannot be zero").refine((n) => Math.abs(n) <= 1_000_000),
  type: z.enum(["ADJUSTMENT", "WRITE_OFF"]),
  note: z.string().trim().min(3, "Give a reason").max(200),
}).refine((v) => v.type !== "WRITE_OFF" || v.delta < 0, { message: "A write-off removes stock", path: ["delta"] });

export const batchUpdateSchema = z.object({
  salePrice: money.gt(0).max(10_00_000).optional(),
  costPrice: money.min(0).max(10_00_000).optional(),
}).refine((v) => v.salePrice !== undefined || v.costPrice !== undefined, "Nothing to update");

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  phone: optText(20),
  gstin: optText(20),
  address: optText(300),
});
export const updateSupplierSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120).optional(),
  phone: z.string().trim().max(20).nullish(),
  gstin: z.string().trim().max(20).nullish(),
  address: z.string().trim().max(300).nullish(),
  isActive: z.boolean().optional(),
});

export const dispenseSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  prescriptionId: z.string().min(1).optional(),
  lines: z.array(z.object({ itemId: z.string().min(1), qty: z.coerce.number().int().min(1).max(100_000) })).min(1, "Add at least one item").max(40),
  discount: money.min(0).max(99_999_999).default(0),
  notes: optText(300),
  clientRef: z.string().trim().min(8).max(64),
  /** Must be true to dispense a prescription that was already dispensed once. */
  refill: z.boolean().optional(),
});

export const voidSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) });
