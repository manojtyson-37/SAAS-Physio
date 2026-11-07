import { moduleGate } from "@/lib/modules/guard";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/guard";
import { tenantScope } from "@/lib/scope";
import { requireTenantSession } from "@/lib/hospital/guard";
import { computeInvoice, formatInvoiceNumber, paiseToDecimal, toPaise } from "@/lib/hospital/billing";
import { createInvoiceSchema } from "@/lib/hospital/billingSchemas";
import { isValidDayKey, istDayRange } from "@/lib/hospital/dates";
import { HttpError, toErrorResponse } from "@/lib/hospital/http";
import { invoiceRow } from "@/lib/hospital/invoiceView";

const STATUSES = ["PAID", "PARTIAL", "UNPAID", "CANCELLED"] as const;

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const off = await moduleGate(session, "billing");
  if (off) return off;
  const sp = req.nextUrl.searchParams;

  const where: Prisma.InvoiceWhereInput = { ...tenantScope(session), deletedAt: null };
  const status = sp.get("status");
  if (status) {
    if (!(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    where.status = status as (typeof STATUSES)[number];
  }
  const patientId = sp.get("patientId");
  if (patientId) where.patientId = patientId;
  const visitId = sp.get("visitId");
  if (visitId) where.visitId = visitId;
  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { patient: { name: { contains: q, mode: "insensitive" } } },
      { patient: { uhid: { contains: q, mode: "insensitive" } } },
    ];
  }
  const from = sp.get("from");
  const to = sp.get("to");
  if ((from && !isValidDayKey(from)) || (to && !isValidDayKey(to))) {
    return NextResponse.json({ error: "Dates must be YYYY-MM-DD" }, { status: 400 });
  }
  if (from || to) {
    where.date = {
      ...(from ? { gte: istDayRange(from).start } : {}),
      ...(to ? { lt: istDayRange(to).end } : {}),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true, number: true, date: true, subtotal: true, gst: true, discount: true, total: true,
      paidAmount: true, status: true, visitId: true,
      patient: { select: { id: true, name: true, uhid: true } },
    },
    orderBy: { date: "desc" },
    take: 300,
  });

  return NextResponse.json({ invoices: invoices.map(invoiceRow) });
}

export async function POST(req: NextRequest) {
  const g = await requireTenantSession(["CLINIC_ADMIN", "STAFF"]);
  if (!g.session) return g.response;
  const off = await moduleGate(g.session, "billing");
  if (off) return off;

  const parsed = createInvoiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { patientId, visitId, lineItems, discount, notes } = parsed.data;

  try {
    const computed = computeInvoice(lineItems, discount);

    // The invoice number is allocated inside the same transaction as the invoice. The counter's row lock
    // serialises creation per clinic, and a rollback also rolls the number back, so numbers stay gap free.
    const invoice = await prisma.$transaction(
      async (tx) => {
        const patient = await tx.patient.findFirst({
          where: { id: patientId, tenantId: g.tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!patient) throw new HttpError(404, "Patient not found");
        if (visitId) {
          const visit = await tx.visit.findFirst({
            where: { id: visitId, tenantId: g.tenantId, deletedAt: null },
            select: { patientId: true },
          });
          if (!visit) throw new HttpError(404, "Visit not found");
          if (visit.patientId !== patientId) throw new HttpError(400, "That visit belongs to a different patient");
        }

        const t = await tx.tenant.update({
          where: { id: g.tenantId },
          data: { invoiceSeq: { increment: 1 } },
          select: { invoiceSeq: true },
        });

        const created = await tx.invoice.create({
          data: {
            tenantId: g.tenantId,
            patientId,
            visitId: visitId ?? null,
            createdById: g.session.userId,
            number: formatInvoiceNumber(t.invoiceSeq),
            subtotal: paiseToDecimal(computed.subtotalPaise),
            gst: paiseToDecimal(computed.gstPaise),
            discount: paiseToDecimal(computed.discountPaise),
            total: paiseToDecimal(computed.totalPaise),
            notes: notes || null,
            status: "UNPAID",
            lineItems: {
              create: computed.lines.map((l, idx) => ({
                sortOrder: idx,
                description: l.description,
                qty: l.qty,
                unitPrice: paiseToDecimal(toPaise(l.unitPrice)),
                gstPercent: l.gstPercent.toFixed(2),
                lineTotal: paiseToDecimal(l.lineTotalPaise),
              })),
            },
          },
          select: { id: true, number: true },
        });
        await tx.auditLog.create({
          data: { tenantId: g.tenantId, actorId: g.session.userId, action: "CREATE", entity: "Invoice", entityId: created.id },
        });
        return created;
      },
      { timeout: 20_000, maxWait: 10_000 }
    );

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
