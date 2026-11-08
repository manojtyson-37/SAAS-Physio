/** Small state rules, kept pure so they can be unit tested. */

export type BedStatus = "AVAILABLE" | "OCCUPIED" | "INACTIVE";

export function bedStatus(bed: { isActive: boolean; wardActive: boolean }, occupied: boolean): BedStatus {
  if (occupied) return "OCCUPIED";
  return bed.isActive && bed.wardActive ? "AVAILABLE" : "INACTIVE";
}

export const canEditAdmission = (status: string) => status === "ADMITTED";

/** Why a bed cannot take a new patient, or null when it can. */
export function bedBlockReason(bed: { isActive: boolean; wardActive: boolean }, occupied: boolean): string | null {
  if (!bed.isActive || !bed.wardActive) return "That bed is not in use";
  if (occupied) return "That bed is already occupied";
  return null;
}

/** "ADM-000012" style number. */
export const formatAdmissionNo = (seq: number) => `ADM-${String(seq).padStart(6, "0")}`;

export const ICU_TYPES = ["ICU", "NICU"] as const;
