import { describe, expect, it } from "vitest";
import { canImgTransition, formatImagingOrderNo, fromStatuses, reportChanged } from "./logic";

describe("imaging transitions", () => {
  it("allows the normal path and skipping SCHEDULED", () => {
    expect(canImgTransition("ORDERED", "SCHEDULED")).toBe(true);
    expect(canImgTransition("ORDERED", "PERFORMED")).toBe(true);
    expect(canImgTransition("SCHEDULED", "PERFORMED")).toBe(true);
    expect(canImgTransition("PERFORMED", "REPORTED")).toBe(true);
  });
  it("rejects skipping to REPORTED and anything out of a final state", () => {
    expect(canImgTransition("ORDERED", "REPORTED")).toBe(false);
    expect(canImgTransition("SCHEDULED", "REPORTED")).toBe(false);
    expect(canImgTransition("REPORTED", "CANCELLED")).toBe(false);
    expect(canImgTransition("CANCELLED", "SCHEDULED")).toBe(false);
    expect(canImgTransition("PERFORMED", "SCHEDULED")).toBe(false);
  });
  it("cancel is possible only before REPORTED", () => {
    expect(fromStatuses("CANCELLED").sort()).toEqual(["ORDERED", "PERFORMED", "SCHEDULED"]);
    expect(fromStatuses("REPORTED")).toEqual(["PERFORMED"]);
    expect(fromStatuses("PERFORMED").sort()).toEqual(["ORDERED", "SCHEDULED"]);
  });
  it("formats numbers", () => {
    expect(formatImagingOrderNo(7)).toBe("IMG-000007");
    expect(formatImagingOrderNo(1000000)).toBe("IMG-1000000");
  });
  it("detects report edits", () => {
    expect(reportChanged({ findings: "a", impression: null }, { findings: " a " })).toBe(false);
    expect(reportChanged({ findings: "a", impression: "x" }, { findings: "a", impression: "y" })).toBe(true);
  });
});
