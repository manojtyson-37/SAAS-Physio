import { describe, expect, it } from "vitest";
import { canLabTransition, effectiveFlag, flagResult, formatLabOrderNo, orderTotals, parseNumeric, rangeText, resultChanged, statusAfterResults } from "./logic";

describe("flagResult", () => {
  it("flags against the range, bounds inclusive", () => {
    expect(flagResult(12, 13, 17)).toBe("LOW");
    expect(flagResult(13, 13, 17)).toBe("NORMAL");
    expect(flagResult(17, 13, 17)).toBe("NORMAL");
    expect(flagResult(17.01, 13, 17)).toBe("HIGH");
  });
  it("handles one-sided ranges", () => {
    expect(flagResult(250, null, 200)).toBe("HIGH");
    expect(flagResult(150, null, 200)).toBe("NORMAL");
    expect(flagResult(1, 2, null)).toBe("LOW");
  });
  it("no value or no range means no flag", () => {
    expect(flagResult(null, 1, 2)).toBeNull();
    expect(flagResult(5, null, null)).toBeNull();
    expect(flagResult(NaN, 1, 2)).toBeNull();
  });
});

describe("parseNumeric", () => {
  it("accepts plain numbers only", () => {
    expect(parseNumeric(" 12.5 ")).toBe(12.5);
    expect(parseNumeric("-3")).toBe(-3);
    expect(parseNumeric("0.12345")).toBe(0.1235);
    for (const bad of ["", "<5", "12 mg", "1e3", "Positive", "1,5", null, undefined]) expect(parseNumeric(bad as string)).toBeNull();
  });
});

describe("effectiveFlag", () => {
  it("technician override wins; text results have no computed flag", () => {
    expect(effectiveFlag("2", 4, 10, "CRITICAL")).toBe("CRITICAL");
    expect(effectiveFlag("2", 4, 10)).toBe("LOW");
    expect(effectiveFlag("Trace", null, null)).toBeNull();
    expect(effectiveFlag("Trace", null, null, "HIGH")).toBe("HIGH");
  });
});

describe("rangeText", () => {
  it("formats", () => {
    expect(rangeText({ refLow: 3.5, refHigh: 5.1 })).toBe("3.5 - 5.1");
    expect(rangeText({ refLow: null, refHigh: 200 })).toBe("up to 200");
    expect(rangeText({ refLow: 2, refHigh: null })).toBe("from 2");
    expect(rangeText({ refLow: null, refHigh: null, refText: "Negative" })).toBe("Negative");
    expect(rangeText({ refLow: null, refHigh: null })).toBe("");
  });
});

describe("orderTotals", () => {
  it("sums in paise with GST", () => {
    expect(orderTotals([{ price: 100, gstPercent: 0 }, { price: 250.5, gstPercent: 18 }])).toEqual({ subtotalPaise: 35050, gstPaise: 4509, totalPaise: 39559 });
    expect(orderTotals([]).totalPaise).toBe(0);
  });
});

describe("numbering and transitions", () => {
  it("formats order numbers", () => {
    expect(formatLabOrderNo(1)).toBe("LAB-000001");
    expect(formatLabOrderNo(1234567)).toBe("LAB-1234567");
  });
  it("only moves forward, and nothing leaves a final state", () => {
    expect(canLabTransition("ORDERED", "COLLECTED")).toBe(true);
    expect(canLabTransition("ORDERED", "RESULTED")).toBe(false);
    expect(canLabTransition("COLLECTED", "CANCELLED")).toBe(true);
    expect(canLabTransition("RESULTED", "CANCELLED")).toBe(false);
    expect(canLabTransition("CANCELLED", "COLLECTED")).toBe(false);
  });
  it("becomes RESULTED only when every item has a value", () => {
    expect(statusAfterResults(["1", "2"])).toBe("RESULTED");
    expect(statusAfterResults(["1", null])).toBe("COLLECTED");
    expect(statusAfterResults(["1", "  "])).toBe("COLLECTED");
    expect(statusAfterResults([])).toBe("COLLECTED");
  });
  it("detects real changes only", () => {
    expect(resultChanged("5", "5.0")).toBe(false);
    expect(resultChanged("5", "6")).toBe(true);
    expect(resultChanged("Negative", " Negative ")).toBe(false);
    expect(resultChanged(null, "1")).toBe(true);
  });
});
