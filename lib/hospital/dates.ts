const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar day in India (YYYY-MM-DD). Token queues restart on this boundary, not UTC midnight. */
export function istDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** [start, end) of an India calendar day given its YYYY-MM-DD key. */
export function istDayRange(key: string): { start: Date; end: Date } {
  const start = new Date(`${key}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** True only for real calendar days: "2026-02-30" and "2026-13-45" are rejected. */
export function isValidDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}
