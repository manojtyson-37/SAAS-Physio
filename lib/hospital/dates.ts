const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar day in India (YYYY-MM-DD). Token queues restart on this boundary, not UTC midnight. */
export function istDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
