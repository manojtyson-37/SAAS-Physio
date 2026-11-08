/** Pure exercise-plan logic: status rules, reorder validation, template snapshots, progress summaries. */

export type ExerciseStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export const EXERCISE_TRANSITIONS: Record<ExerciseStatus, ExerciseStatus[]> = { ACTIVE: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [] };
export const canMoveTo = (from: ExerciseStatus, to: ExerciseStatus) => EXERCISE_TRANSITIONS[from].includes(to);

/** True when `order` lists exactly the ids in `current`, once each. */
export function isValidReorder(current: string[], order: string[]): boolean {
  if (current.length !== order.length) return false;
  const set = new Set(order);
  if (set.size !== order.length) return false;
  return current.every((id) => set.has(id));
}

type Tpl = { id: string; name: string; sets: number | null; reps: number | null; holdSeconds: number | null; instructions: string | null };
type Over = { name?: string; sets?: number | null; reps?: number | null; holdSeconds?: number | null; frequency?: string | null; instructions?: string | null };

/** Plan item values copied from a template (so later template edits never change an issued plan); overrides win. */
export function snapshotFromTemplate(t: Tpl, o: Over = {}) {
  return {
    templateId: t.id,
    name: o.name?.trim() || t.name,
    sets: o.sets !== undefined ? o.sets : t.sets,
    reps: o.reps !== undefined ? o.reps : t.reps,
    holdSeconds: o.holdSeconds !== undefined ? o.holdSeconds : t.holdSeconds,
    frequency: o.frequency ?? null,
    instructions: o.instructions !== undefined ? o.instructions : t.instructions,
  };
}

/** "3 sets x 10 reps, hold 5 s" style text. */
export function prescriptionText(i: { sets: number | null; reps: number | null; holdSeconds: number | null; frequency?: string | null }): string {
  const parts: string[] = [];
  if (i.sets && i.reps) parts.push(`${i.sets} sets of ${i.reps}`);
  else if (i.sets) parts.push(`${i.sets} sets`);
  else if (i.reps) parts.push(`${i.reps} reps`);
  if (i.holdSeconds) parts.push(`hold ${i.holdSeconds} seconds`);
  if (i.frequency) parts.push(i.frequency);
  return parts.join(", ");
}

export type ProgressPoint = { recordedAt: string | Date; painScore: number | null; adherencePercent: number | null };
export type ProgressSummary = { entries: number; avgAdherence: number | null; latestPain: number | null; firstPain: number | null; painChange: number | null };

export function progressSummary(points: ProgressPoint[]): ProgressSummary {
  const sorted = [...points].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const pains = sorted.filter((p) => p.painScore !== null);
  const adh = sorted.filter((p) => p.adherencePercent !== null);
  const first = pains[0]?.painScore ?? null;
  const latest = pains[pains.length - 1]?.painScore ?? null;
  return {
    entries: sorted.length,
    avgAdherence: adh.length ? Math.round(adh.reduce((s, p) => s + (p.adherencePercent as number), 0) / adh.length) : null,
    firstPain: first,
    latestPain: latest,
    painChange: pains.length >= 2 && first !== null && latest !== null ? latest - first : null,
  };
}

/** Chart rows in time order, labelled with an India-calendar day. */
export function chartRows(points: ProgressPoint[]) {
  return [...points]
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((p) => ({
      label: new Date(p.recordedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
      pain: p.painScore, adherence: p.adherencePercent,
    }));
}
