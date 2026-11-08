import { describe, expect, it } from "vitest";
import { filterOptions } from "@/components/SearchSelect";

const opts = [
  { value: "1", label: "Karan Malhotra" },
  { value: "2", label: "Vikram Singh" },
  { value: "3", label: "Kavita Rao", hint: "Dental" },
];

describe("filterOptions", () => {
  it("matches any part of the name, any case", () => {
    expect(filterOptions(opts, "malh").map((o) => o.value)).toEqual(["1"]);
    expect(filterOptions(opts, "SING").map((o) => o.value)).toEqual(["2"]);
  });
  it("needs every typed word, in any order", () => {
    expect(filterOptions(opts, "mal kar").map((o) => o.value)).toEqual(["1"]);
    expect(filterOptions(opts, "ka").map((o) => o.value)).toEqual(["1", "3"]);
  });
  it("searches the hint too and returns everything for an empty query", () => {
    expect(filterOptions(opts, "dental").map((o) => o.value)).toEqual(["3"]);
    expect(filterOptions(opts, "")).toHaveLength(3);
  });
  it("caps the list", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ value: String(i), label: `Patient ${i}` }));
    expect(filterOptions(many, "patient")).toHaveLength(60);
  });
});
