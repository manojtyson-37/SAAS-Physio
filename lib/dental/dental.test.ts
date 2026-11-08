import { describe, expect, it } from "vitest";
import { ADULT_TEETH, DECIDUOUS_TEETH, CONDITIONS, CONDITION_STYLE, currentState, isValidTooth, normalizeSurfaces, quadrantOf, toothName } from "./fdi";
import { canMarkDone, canTransition, planIsOpen, planTotals, transitionBlocker } from "./plan";
import { addItemSchema, toothRecordSchema, updateItemSchema } from "./schemas";

describe("FDI", () => {
  it("has 32 adult and 20 deciduous teeth", () => {
    expect(ADULT_TEETH).toHaveLength(32);
    expect(DECIDUOUS_TEETH).toHaveLength(20);
  });
  it("validates numbers", () => {
    for (const n of [11, 18, 28, 31, 48, 51, 55, 65, 71, 85]) expect(isValidTooth(n)).toBe(true);
    for (const n of [0, 10, 19, 29, 49, 56, 66, 76, 86, 90, 1.5, NaN]) expect(isValidTooth(n)).toBe(false);
    expect(isValidTooth("16")).toBe(false);
  });
  it("names and quadrants", () => {
    expect(toothName(16)).toBe("Upper right first molar");
    expect(toothName(38)).toBe("Lower left third molar");
    expect(toothName(54)).toBe("Upper right primary first molar");
    expect(toothName(83)).toBe("Lower right primary canine");
    expect(quadrantOf(46)).toBe(4);
    expect(quadrantOf(61)).toBe(2);
    expect(quadrantOf(75)).toBe(3);
  });
  it("has a style for each condition", () => {
    for (const c of CONDITIONS) expect(CONDITION_STYLE[c].label).toBeTruthy();
  });
  it("normalises surfaces", () => {
    expect(normalizeSurfaces("dom")).toBe("MOD");
    expect(normalizeSurfaces(" m, o ")).toBe("MO");
    expect(normalizeSurfaces("")).toBeNull();
    expect(normalizeSurfaces(null)).toBeNull();
    expect(normalizeSurfaces("MX")).toBeUndefined();
    expect(normalizeSurfaces("MM")).toBe("M");
  });
  it("current state is the newest record per tooth", () => {
    const mk = (id: string, tooth: number, t: number, condition: string) => ({ id, tooth, createdAt: new Date(t), condition, surfaces: null, notes: null });
    const s = currentState([mk("a", 16, 1, "CARIES"), mk("b", 16, 5, "FILLED"), mk("c", 11, 2, "HEALTHY"), mk("d", 16, 3, "CROWN")]);
    expect(s.get(16)?.condition).toBe("FILLED");
    expect(s.get(11)?.id).toBe("c");
    expect(s.size).toBe(2);
  });
});

describe("plan rules", () => {
  it("transition table", () => {
    expect(canTransition("PROPOSED", "ACCEPTED")).toBe(true);
    expect(canTransition("PROPOSED", "COMPLETED")).toBe(false);
    expect(canTransition("ACCEPTED", "PROPOSED")).toBe(false);
    expect(canTransition("IN_PROGRESS", "CANCELLED")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "ACCEPTED")).toBe(false);
  });
  it("completing needs all items settled and one done", () => {
    expect(transitionBlocker("IN_PROGRESS", "COMPLETED", [{ status: "DONE" }, { status: "PLANNED" }])).toMatch(/planned/i);
    expect(transitionBlocker("IN_PROGRESS", "COMPLETED", [{ status: "CANCELLED" }])).toMatch(/at least one/i);
    expect(transitionBlocker("IN_PROGRESS", "COMPLETED", [{ status: "DONE" }, { status: "CANCELLED" }])).toBeNull();
    expect(transitionBlocker("PROPOSED", "ACCEPTED", [])).toMatch(/at least one procedure/i);
    expect(transitionBlocker("PROPOSED", "ACCEPTED", [{ status: "PLANNED" }])).toBeNull();
  });
  it("open and done gates", () => {
    expect(planIsOpen("PROPOSED")).toBe(true);
    expect(planIsOpen("COMPLETED")).toBe(false);
    expect(canMarkDone("PROPOSED")).toBe(false);
    expect(canMarkDone("ACCEPTED")).toBe(true);
  });
  it("totals in paise, GST included, cancelled ignored", () => {
    const t = planTotals([
      { price: 1000, gstPercent: 18, status: "DONE" },
      { price: 500.5, gstPercent: 0, status: "PLANNED" },
      { price: 9999, gstPercent: 0, status: "CANCELLED" },
    ]);
    expect(t.done).toBe(118000);
    expect(t.gstDone).toBe(18000);
    expect(t.planned).toBe(50050);
    expect(t.doneCount).toBe(1);
    expect(t.plannedCount).toBe(1);
  });
});

describe("schemas", () => {
  it("rejects bad tooth and surfaces, normalises good", () => {
    expect(toothRecordSchema.safeParse({ tooth: 19, condition: "CARIES" }).success).toBe(false);
    expect(toothRecordSchema.safeParse({ tooth: 16, condition: "NOPE" }).success).toBe(false);
    expect(toothRecordSchema.safeParse({ tooth: 16, condition: "CARIES", surfaces: "Z" }).success).toBe(false);
    const ok = toothRecordSchema.parse({ tooth: "16", condition: "CARIES", surfaces: "do" });
    expect(ok.tooth).toBe(16);
    expect(ok.surfaces).toBe("OD");
  });
  it("item price must be positive; update has no defaults", () => {
    expect(addItemSchema.safeParse({ procedure: "Filling", price: 0 }).success).toBe(false);
    expect(addItemSchema.parse({ procedure: "Filling", price: 500 }).gstPercent).toBe(0);
    expect(updateItemSchema.parse({ price: 10 })).toEqual({ price: 10 });
  });
});
