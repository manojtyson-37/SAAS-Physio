import { z } from "zod";

export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Netbanking"] as const;
export const SERVICE_CATEGORIES = ["Consultation", "Procedure", "Therapy", "Lab", "Radiology", "Pharmacy", "Other"] as const;

const money = z.coerce.number().finite();

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(200),
  qty: z.coerce.number().int().min(1).max(1000),
  unitPrice: money.positive("Price must be greater than zero").max(10_00_000),
  gstPercent: money.min(0).max(28).default(0),
});

export const createInvoiceSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  lineItems: z.array(invoiceLineSchema).min(1, "Add at least one line item").max(50),
  discount: money.min(0).max(99_999_999).default(0),
  notes: z.string().trim().max(500).optional(),
});

/** Editing replaces the line items; patient and visit link are fixed after creation. */
export const updateInvoiceSchema = z.object({
  lineItems: z.array(invoiceLineSchema).min(1).max(50),
  discount: money.min(0).max(99_999_999).default(0),
  notes: z.string().trim().max(500).nullish(),
});

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: money.positive(),
  reference: z.string().trim().max(100).optional(),
  /** Client-generated id so a double click / retry cannot record the same payment twice. */
  clientRef: z.string().trim().min(8).max(64).optional(),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason").max(300),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(SERVICE_CATEGORIES).default("Consultation"),
  price: money.positive().max(10_00_000),
  gstPercent: money.min(0).max(28).default(0),
});

export const updateServiceSchema = serviceSchema.partial().extend({ isActive: z.boolean().optional() });
