/** Pure bed-charge maths. Money in integer paise, like lib/hospital/billing.ts. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Billable days of one stay: every started 24 hours counts, minimum one day. */
export function stayDays(startedAt: Date, endedAt: Date): number {
  const ms = endedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

export type StayInput = { startedAt: Date; endedAt: Date | null; ratePaise: number; label: string };
export type StayCharge = { label: string; days: number; ratePaise: number; amountPaise: number };

/** One charge per stay. A stay still open is priced up to `now`. */
export function bedCharges(stays: StayInput[], now: Date): { lines: StayCharge[]; totalPaise: number } {
  const lines = stays.map((s) => {
    const days = stayDays(s.startedAt, s.endedAt ?? now);
    return { label: s.label, days, ratePaise: s.ratePaise, amountPaise: days * s.ratePaise };
  });
  return { lines, totalPaise: lines.reduce((t, l) => t + l.amountPaise, 0) };
}
