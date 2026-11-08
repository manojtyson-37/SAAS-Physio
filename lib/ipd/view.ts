import { stayDays } from "./billing";

/** Public shape of an admission for lists and the bed board. Never include user rows beyond the whitelisted fields. */
export const admissionSelect = {
  id: true, admissionNo: true, status: true, admittedAt: true, dischargedAt: true, expectedDischargeAt: true,
  reason: true, diagnosis: true, notes: true, bedId: true, invoiceId: true,
  patient: { select: { id: true, name: true, uhid: true, phone: true } },
  doctor: { select: { id: true, name: true, title: true } },
  bed: { select: { id: true, label: true, ward: { select: { id: true, name: true, type: true } } } },
} as const;

type AdmissionRow = {
  id: string; admissionNo: string; status: string; admittedAt: Date; dischargedAt: Date | null; expectedDischargeAt: Date | null;
  reason: string | null; diagnosis: string | null; notes: string | null; bedId: string | null; invoiceId: string | null;
  patient: { id: string; name: string; uhid: string | null; phone: string };
  doctor: { id: string; name: string; title: string | null };
  bed: { id: string; label: string; ward: { id: string; name: string; type: string } } | null;
};

export function admissionView(a: AdmissionRow, now = new Date()) {
  return {
    id: a.id, admissionNo: a.admissionNo, status: a.status, admittedAt: a.admittedAt, dischargedAt: a.dischargedAt,
    expectedDischargeAt: a.expectedDischargeAt, reason: a.reason, diagnosis: a.diagnosis, notes: a.notes, invoiceId: a.invoiceId,
    days: stayDays(a.admittedAt, a.dischargedAt ?? now),
    patient: a.patient, doctor: a.doctor,
    bed: a.bed ? { id: a.bed.id, label: a.bed.label, wardId: a.bed.ward.id, wardName: a.bed.ward.name, wardType: a.bed.ward.type } : null,
  };
}
