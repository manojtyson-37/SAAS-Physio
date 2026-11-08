import { describe, expect, it } from "vitest";
import { bedCharges, stayDays } from "./billing";
import { bedBlockReason, bedStatus, formatAdmissionNo } from "./rules";
import { admitSchema, chartSchema, updateChartSchema } from "./schemas";

const h = (n: number) => n * 3600_000;
const t0 = new Date("2026-11-01T10:00:00Z");

describe("stayDays", () => {
  it("is at least one day", () => {
    expect(stayDays(t0, t0)).toBe(1);
    expect(stayDays(t0, new Date(t0.getTime() + h(1)))).toBe(1);
  });
  it("exactly 24h is one day, 24h+1min is two", () => {
    expect(stayDays(t0, new Date(t0.getTime() + h(24)))).toBe(1);
    expect(stayDays(t0, new Date(t0.getTime() + h(24) + 60_000))).toBe(2);
    expect(stayDays(t0, new Date(t0.getTime() + h(72)))).toBe(3);
  });
  it("end before start is one day, not negative", () => {
    expect(stayDays(t0, new Date(t0.getTime() - h(5)))).toBe(1);
  });
});

describe("bedCharges", () => {
  it("sums per stay, each with its own minimum day", () => {
    const r = bedCharges([
      { startedAt: t0, endedAt: new Date(t0.getTime() + h(30)), ratePaise: 100_000, label: "Gen" },
      { startedAt: new Date(t0.getTime() + h(30)), endedAt: new Date(t0.getTime() + h(31)), ratePaise: 500_000, label: "ICU" },
    ], new Date(t0.getTime() + h(99)));
    expect(r.lines.map((l) => l.days)).toEqual([2, 1]);
    expect(r.totalPaise).toBe(2 * 100_000 + 500_000);
  });
  it("prices an open stay up to now", () => {
    const r = bedCharges([{ startedAt: t0, endedAt: null, ratePaise: 100_000, label: "Gen" }], new Date(t0.getTime() + h(49)));
    expect(r.totalPaise).toBe(3 * 100_000);
  });
  it("free beds cost nothing", () => {
    expect(bedCharges([{ startedAt: t0, endedAt: null, ratePaise: 0, label: "x" }], t0).totalPaise).toBe(0);
  });
});

describe("rules", () => {
  it("bed status", () => {
    expect(bedStatus({ isActive: true, wardActive: true }, false)).toBe("AVAILABLE");
    expect(bedStatus({ isActive: true, wardActive: true }, true)).toBe("OCCUPIED");
    expect(bedStatus({ isActive: false, wardActive: true }, false)).toBe("INACTIVE");
    expect(bedStatus({ isActive: true, wardActive: false }, false)).toBe("INACTIVE");
  });
  it("block reasons", () => {
    expect(bedBlockReason({ isActive: true, wardActive: true }, false)).toBeNull();
    expect(bedBlockReason({ isActive: true, wardActive: true }, true)).toMatch(/occupied/);
    expect(bedBlockReason({ isActive: false, wardActive: true }, false)).toMatch(/not in use/);
  });
  it("admission number", () => expect(formatAdmissionNo(12)).toBe("ADM-000012"));
});

describe("schemas", () => {
  it("admit requires patient and doctor", () => {
    expect(admitSchema.safeParse({ patientId: "", doctorId: "d" }).success).toBe(false);
    expect(admitSchema.safeParse({ patientId: "p", doctorId: "d", reason: "  " }).success).toBe(true);
  });
  it("chart needs a value or note; blanks are ignored", () => {
    expect(chartSchema.safeParse({ pulse: "" }).success).toBe(false);
    const ok = chartSchema.safeParse({ pulse: "88", tempC: "37.5", systolic: "", notes: "" });
    expect(ok.success && ok.data.pulse).toBe(88);
    expect(chartSchema.safeParse({ spo2: 140 }).success).toBe(false);
    expect(chartSchema.safeParse({ gcs: 2 }).success).toBe(false);
    expect(chartSchema.safeParse({ notes: "Slept well" }).success).toBe(true);
  });
  it("chart update does not re-apply defaults and can clear values", () => {
    const r = updateChartSchema.safeParse({ pulse: null });
    expect(r.success && r.data).toEqual({ pulse: null });
    expect(updateChartSchema.safeParse({}).success).toBe(false);
  });
});
