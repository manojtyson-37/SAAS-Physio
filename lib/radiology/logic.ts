export const MODALITIES = ["XRAY", "ULTRASOUND", "CT", "MRI", "ECG", "OTHER"] as const;
export type Modality = (typeof MODALITIES)[number];
export const MODALITY_LABEL: Record<Modality, string> = { XRAY: "X-ray", ULTRASOUND: "Ultrasound", CT: "CT", MRI: "MRI", ECG: "ECG", OTHER: "Other" };

export type ImagingStatus = "ORDERED" | "SCHEDULED" | "PERFORMED" | "REPORTED" | "CANCELLED";

/** "IMG" + 7 -> "IMG-000007". Sequences past 6 digits are kept whole. */
export const formatImagingOrderNo = (seq: number) => `IMG-${String(seq).padStart(6, "0")}`;

/**
 * Allowed status moves. Scheduling can be skipped (walk-in), and re-scheduling stays in SCHEDULED.
 * REPORTED is final for status; a report correction keeps REPORTED and is audited.
 */
export const IMG_TRANSITIONS: Record<ImagingStatus, ImagingStatus[]> = {
  ORDERED: ["SCHEDULED", "PERFORMED", "CANCELLED"],
  SCHEDULED: ["SCHEDULED", "PERFORMED", "CANCELLED"],
  PERFORMED: ["REPORTED", "CANCELLED"],
  REPORTED: [],
  CANCELLED: [],
};
export const canImgTransition = (from: ImagingStatus, to: ImagingStatus) => IMG_TRANSITIONS[from].includes(to);

/** Statuses a CAS update must start from for a target status. */
export const fromStatuses = (to: ImagingStatus): ImagingStatus[] =>
  (Object.keys(IMG_TRANSITIONS) as ImagingStatus[]).filter((s) => canImgTransition(s, to));

/** True when the submitted report text differs from what is stored (whitespace-insensitive at the ends). */
export const reportChanged = (prev: { findings: string | null; impression: string | null }, next: { findings: string; impression?: string | null }) =>
  (prev.findings ?? "").trim() !== next.findings.trim() || (prev.impression ?? "").trim() !== (next.impression ?? "").trim();
