export const CHART_SELECT = {
  id: true, kind: true, recordedAt: true, recordedById: true, systolic: true, diastolic: true, pulse: true, respRate: true,
  spo2: true, tempC: true, gcs: true, intakeMl: true, outputMl: true, notes: true,
} as const;

type Row = { tempC: unknown } & Record<string, unknown>;

export function chartView<T extends Row>(r: T) {
  return { ...r, tempC: r.tempC === null || r.tempC === undefined ? null : Number(r.tempC) };
}
