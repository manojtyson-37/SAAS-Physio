import { describe, expect, it } from "vitest";
import { buildPrefill } from "./prefill";
import { canEditSummary, canFinalize } from "./rules";

describe("buildPrefill", () => {
  it("uses admission diagnosis and reason", () => {
    const p = buildPrefill({ admission: { diagnosis: "Dengue", reason: "Fever 4 days" } });
    expect(p.diagnosis).toBe("Dengue");
    expect(p.courseInHospital).toBe("Admitted for: Fever 4 days");
    expect(p.investigationsSummary).toBe("");
    expect(p.medicationsOnDischarge).toBe("");
  });
  it("lists labs with unit and abnormal flags, then imaging", () => {
    const p = buildPrefill({
      admission: { diagnosis: null, reason: null },
      labs: [{ testName: "Platelets", resultValue: "60", unit: "x10^3/uL", flag: "LOW" }, { testName: "Hb", resultValue: "13", unit: null, flag: "NORMAL" }],
      imaging: [{ studyName: "Chest X-ray", impression: "Clear" }],
    });
    expect(p.investigationsSummary).toBe("Laboratory\nPlatelets: 60 x10^3/uL [LOW]\nHb: 13\nImaging\nChest X-ray: Clear");
  });
  it("numbers medications", () => {
    const p = buildPrefill({
      admission: { diagnosis: null, reason: null },
      rx: [{ genericName: "paracetamol", brandName: "Dolo", strength: "650 mg", form: "Tablet", dose: "1 tab", frequency: "1-1-1", durationDays: 3, instructions: "after food" }],
    });
    expect(p.medicationsOnDischarge).toBe("1. Dolo 650 mg Tablet - 1 tab, 1-1-1, for 3 days (after food)");
  });
});

describe("summary rules", () => {
  it("blocks edits before discharge and after final", () => {
    expect(canEditSummary("ADMITTED", null).ok).toBe(false);
    expect(canEditSummary("DISCHARGED", "FINAL")).toMatchObject({ ok: false, status: 409 });
    expect(canEditSummary("DISCHARGED", "DRAFT").ok).toBe(true);
    expect(canEditSummary("DISCHARGED", null).ok).toBe(true);
  });
  it("finalize needs discharged, a draft and a diagnosis", () => {
    expect(canFinalize("ADMITTED", "DRAFT", "x").ok).toBe(false);
    expect(canFinalize("DISCHARGED", null, "x")).toMatchObject({ status: 404 });
    expect(canFinalize("DISCHARGED", "FINAL", "x")).toMatchObject({ status: 409 });
    expect(canFinalize("DISCHARGED", "DRAFT", "  ")).toMatchObject({ status: 400 });
    expect(canFinalize("DISCHARGED", "DRAFT", "Dengue").ok).toBe(true);
  });
});
