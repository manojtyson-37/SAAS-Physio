import { toPaise } from "./billing";

type Dec = { toString(): string } | number | string;
const n = (d: Dec) => Number(d.toString());

/** Shape shared by list rows; cancelled invoices owe nothing. */
export function invoiceRow(i: {
  id: string;
  number: string;
  date: Date;
  subtotal: Dec;
  gst: Dec;
  discount: Dec;
  total: Dec;
  paidAmount: Dec;
  status: string;
  visitId: string | null;
  patient: { id: string; name: string; uhid: string | null };
}) {
  const total = n(i.total);
  const paid = n(i.paidAmount);
  const balancePaise = i.status === "CANCELLED" ? 0 : Math.max(0, toPaise(total) - toPaise(paid));
  return {
    id: i.id,
    number: i.number,
    date: i.date,
    patient: i.patient,
    visitId: i.visitId,
    subtotal: n(i.subtotal),
    gst: n(i.gst),
    discount: n(i.discount),
    total,
    paidAmount: paid,
    balance: balancePaise / 100,
    status: i.status,
  };
}
