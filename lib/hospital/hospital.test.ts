import { describe, it, expect } from "vitest";
import { formatUhid } from "./uhid";
import { istDateKey } from "./dates";
import { calcBmi } from "./vitals";
import { vitalsSchema, prescriptionSchema, registerPatientSchema, createVisitSchema } from "./schemas";

describe("formatUhid", () => {
  it("pads the sequence to 6 digits with the tenant prefix", () => {
    expect(formatUhid("UH", 42)).toBe("UH-000042");
    expect(formatUhid("SRI", 1)).toBe("SRI-000001");
  });
  it("does not truncate sequences above 6 digits", () => {
    expect(formatUhid("UH", 1234567)).toBe("UH-1234567");
  });
});

describe("istDateKey", () => {
  it("uses the India calendar day, not UTC", () => {
    // 2026-11-06 20:00 UTC == 2026-11-07 01:30 IST
    expect(istDateKey(new Date("2026-11-06T20:00:00Z"))).toBe("2026-11-07");
    // 2026-11-07 18:00 UTC == 2026-11-07 23:30 IST
    expect(istDateKey(new Date("2026-11-07T18:00:00Z"))).toBe("2026-11-07");
  });
});

describe("calcBmi", () => {
  it("computes BMI to one decimal", () => {
    expect(calcBmi(70, 175)).toBe(22.9);
  });
  it("returns null when an input is missing or invalid", () => {
    expect(calcBmi(undefined, 175)).toBeNull();
    expect(calcBmi(70, 0)).toBeNull();
    expect(calcBmi(0, 170)).toBeNull();
  });
});

describe("vitalsSchema", () => {
  it("accepts a normal reading and derives nothing it was not given", () => {
    const r = vitalsSchema.safeParse({ systolic: 120, diastolic: 80, pulse: 72, spo2: 98, tempC: 36.8 });
    expect(r.success).toBe(true);
  });
  it("rejects physiologically impossible values", () => {
    expect(vitalsSchema.safeParse({ spo2: 140 }).success).toBe(false);
    expect(vitalsSchema.safeParse({ pulse: 5 }).success).toBe(false);
    expect(vitalsSchema.safeParse({ tempC: 60 }).success).toBe(false);
  });
  it("rejects diastolic >= systolic", () => {
    expect(vitalsSchema.safeParse({ systolic: 80, diastolic: 90 }).success).toBe(false);
  });
  it("requires at least one measurement", () => {
    expect(vitalsSchema.safeParse({}).success).toBe(false);
  });
});

describe("prescriptionSchema", () => {
  const item = { genericName: "Paracetamol", strength: "500 mg", form: "Tablet", frequency: "1-1-1", durationDays: 5 };
  it("accepts a generic-named item", () => {
    expect(prescriptionSchema.safeParse({ items: [item] }).success).toBe(true);
  });
  it("requires a generic name and a frequency", () => {
    expect(prescriptionSchema.safeParse({ items: [{ ...item, genericName: "  " }] }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ items: [{ ...item, frequency: "" }] }).success).toBe(false);
  });
  it("requires at least one item and caps the list", () => {
    expect(prescriptionSchema.safeParse({ items: [] }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ items: Array(41).fill(item) }).success).toBe(false);
  });
  it("rejects non-positive durations", () => {
    expect(prescriptionSchema.safeParse({ items: [{ ...item, durationDays: 0 }] }).success).toBe(false);
  });
});

describe("registerPatientSchema", () => {
  it("accepts a valid ABHA number with or without dashes", () => {
    expect(registerPatientSchema.safeParse({ name: "A", phone: "9876543210", abhaId: "12-3456-7890-1234" }).success).toBe(true);
    expect(registerPatientSchema.safeParse({ name: "A", phone: "9876543210", abhaId: "12345678901234" }).success).toBe(true);
  });
  it("rejects a malformed ABHA number and future DOB", () => {
    expect(registerPatientSchema.safeParse({ name: "A", phone: "9876543210", abhaId: "123" }).success).toBe(false);
    expect(registerPatientSchema.safeParse({ name: "A", phone: "9876543210", dob: "2999-01-01" }).success).toBe(false);
  });
});

describe("createVisitSchema", () => {
  it("defaults to OPD", () => {
    const r = createVisitSchema.parse({ patientId: "p1", doctorId: "d1" });
    expect(r.type).toBe("OPD");
  });
});

import { canTransition } from "./visit";

describe("canTransition", () => {
  it("allows the normal OPD flow", () => {
    expect(canTransition("WAITING", "IN_CONSULT")).toBe(true);
    expect(canTransition("IN_CONSULT", "COMPLETED")).toBe(true);
  });
  it("allows cancelling an open visit", () => {
    expect(canTransition("WAITING", "CANCELLED")).toBe(true);
    expect(canTransition("IN_CONSULT", "CANCELLED")).toBe(true);
  });
  it("blocks skipping consult and leaving a terminal state", () => {
    expect(canTransition("WAITING", "COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED", "IN_CONSULT")).toBe(false);
    expect(canTransition("CANCELLED", "WAITING")).toBe(false);
  });
  it("treats a same-state change as a no-op, not a transition", () => {
    expect(canTransition("WAITING", "WAITING")).toBe(false);
  });
});
