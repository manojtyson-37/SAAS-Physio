export type VisitStatusName = "WAITING" | "IN_CONSULT" | "COMPLETED" | "CANCELLED";

const ALLOWED: Record<VisitStatusName, VisitStatusName[]> = {
  WAITING: ["IN_CONSULT", "CANCELLED"],
  IN_CONSULT: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: VisitStatusName, to: VisitStatusName): boolean {
  return ALLOWED[from].includes(to);
}

export const isOpen = (s: VisitStatusName) => s === "WAITING" || s === "IN_CONSULT";
