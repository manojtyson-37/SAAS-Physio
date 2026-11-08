import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES } from "./starterTemplates";
import { canMoveTo, chartRows, isValidReorder, prescriptionText, progressSummary, snapshotFromTemplate } from "./logic";
import { createPlanSchema, progressSchema, templateSchema, updateItemSchema } from "./schemas";

describe("starter library", () => {
  it("has ~20 unique, complete templates", () => {
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(STARTER_TEMPLATES.map((t) => t.name.toLowerCase())).size).toBe(STARTER_TEMPLATES.length);
    for (const t of STARTER_TEMPLATES) {
      expect(t.category).toBeTruthy();
      expect(t.instructions.length).toBeGreaterThan(20);
      expect(t.sets).toBeGreaterThan(0);
    }
  });
});

describe("logic", () => {
  it("status moves", () => {
    expect(canMoveTo("ACTIVE", "COMPLETED")).toBe(true);
    expect(canMoveTo("ACTIVE", "CANCELLED")).toBe(true);
    expect(canMoveTo("COMPLETED", "ACTIVE")).toBe(false);
    expect(canMoveTo("CANCELLED", "COMPLETED")).toBe(false);
  });
  it("reorder must be an exact permutation", () => {
    expect(isValidReorder(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(isValidReorder(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isValidReorder(["a", "b", "c"], ["a", "a", "b"])).toBe(false);
    expect(isValidReorder(["a", "b"], ["a", "x"])).toBe(false);
  });
  it("snapshot copies template values and honours overrides", () => {
    const t = { id: "t1", name: "Bridging", sets: 3, reps: 10, holdSeconds: 5, instructions: "Lift" };
    expect(snapshotFromTemplate(t)).toMatchObject({ templateId: "t1", name: "Bridging", sets: 3, reps: 10, holdSeconds: 5, instructions: "Lift", frequency: null });
    expect(snapshotFromTemplate(t, { sets: 5, reps: null, frequency: "daily" })).toMatchObject({ sets: 5, reps: null, holdSeconds: 5, frequency: "daily" });
  });
  it("prescription text", () => {
    expect(prescriptionText({ sets: 3, reps: 10, holdSeconds: 5, frequency: "twice daily" })).toBe("3 sets of 10, hold 5 seconds, twice daily");
    expect(prescriptionText({ sets: null, reps: null, holdSeconds: 30, frequency: null })).toBe("hold 30 seconds");
  });
  it("progress summary", () => {
    const s = progressSummary([
      { recordedAt: "2026-01-10", painScore: 4, adherencePercent: 80 },
      { recordedAt: "2026-01-01", painScore: 8, adherencePercent: 60 },
      { recordedAt: "2026-01-20", painScore: null, adherencePercent: null },
    ]);
    expect(s).toEqual({ entries: 3, avgAdherence: 70, firstPain: 8, latestPain: 4, painChange: -4 });
    expect(progressSummary([]).avgAdherence).toBeNull();
    expect(chartRows([{ recordedAt: "2026-01-10T00:00:00Z", painScore: 3, adherencePercent: 50 }])[0]).toMatchObject({ pain: 3, adherence: 50 });
  });
});

describe("schemas", () => {
  it("progress bounds", () => {
    expect(progressSchema.safeParse({ painScore: 11 }).success).toBe(false);
    expect(progressSchema.safeParse({ painScore: -1 }).success).toBe(false);
    expect(progressSchema.safeParse({ adherencePercent: 101 }).success).toBe(false);
    expect(progressSchema.safeParse({}).success).toBe(false);
    expect(progressSchema.safeParse({ painScore: 0, adherencePercent: 100 }).success).toBe(true);
  });
  it("template: blank numbers become null; update keeps omitted fields untouched", () => {
    expect(templateSchema.parse({ name: "Squat", sets: "", reps: 10 })).toMatchObject({ sets: null, reps: 10, category: "General" });
    expect(updateItemSchema.parse({ reps: 8 })).toEqual({ reps: 8 });
    expect(updateItemSchema.parse({ sets: "" })).toEqual({ sets: null });
  });
  it("plan items need a template or a name; overrides stay undefined when omitted", () => {
    expect(createPlanSchema.safeParse({ patientId: "p", title: "Knee", items: [{}] }).success).toBe(false);
    const ok = createPlanSchema.parse({ patientId: "p", title: "Knee", items: [{ templateId: "t" }] });
    expect(ok.items[0].sets).toBeUndefined();
    expect(ok.items[0].instructions).toBeUndefined();
  });
});
