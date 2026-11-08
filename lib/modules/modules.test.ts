import { describe, expect, it } from "vitest";
import { MODULES, MODULE_KEYS, PLANNED_MODULES, isModuleKey, moduleForPath } from "./registry";
import { CLINIC_TYPES, CLINIC_TYPE_KEYS, clinicTypeDef } from "./clinicTypes";
import { allModules, parseSelection, resolveModules } from "./resolve";
import { getNavItems } from "../nav";

describe("registry integrity", () => {
  it("has unique module keys and nav links", () => {
    expect(new Set(MODULE_KEYS).size).toBe(MODULE_KEYS.length);
    const hrefs = MODULES.flatMap((m) => m.nav.map((n) => n.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("planned module keys never clash with real ones", () => {
    for (const p of PLANNED_MODULES) expect(isModuleKey(p.key)).toBe(false);
  });

  it("every nav href is covered by its module's page prefixes", () => {
    for (const m of MODULES) for (const n of m.nav) expect(moduleForPath(n.href)).toBe(m.key);
  });

  it("maps nested paths to the owning module and leaves core paths ungated", () => {
    expect(moduleForPath("/app/opd/abc-123")).toBe("opd");
    expect(moduleForPath("/app/invoices/new")).toBe("billing");
    expect(moduleForPath("/app/services")).toBe("billing");
    expect(moduleForPath("/app/patients")).toBeNull();
    expect(moduleForPath("/app")).toBeNull();
    expect(moduleForPath("/app/opdx")).toBeNull();
  });
});

describe("clinic type presets", () => {
  it("only reference real modules and have usable content", () => {
    for (const k of CLINIC_TYPE_KEYS) {
      const t = CLINIC_TYPES[k];
      expect(t.defaultModules.every(isModuleKey)).toBe(true);
      expect(new Set(t.defaultModules).size).toBe(t.defaultModules.length);
      expect(t.specialties.length).toBeGreaterThan(2);
      expect(t.starterServices.length).toBeGreaterThan(4);
      expect(new Set(t.starterServices.map((s) => s.name)).size).toBe(t.starterServices.length);
      expect(t.starterServices.every((s) => Number(s.price) > 0)).toBe(true);
      expect(t.appointmentMinutes).toBeGreaterThan(0);
    }
  });

  it("covers the five clinic types and falls back safely", () => {
    expect(CLINIC_TYPE_KEYS.sort()).toEqual(["DENTAL", "GENERAL", "HOSPITAL", "ORTHO", "PHYSIOTHERAPY"]);
    expect(clinicTypeDef("DENTAL").terms.package).toBe("Treatment plan");
    expect(clinicTypeDef("nonsense").key).toBe("PHYSIOTHERAPY");
    expect(clinicTypeDef(null).key).toBe("PHYSIOTHERAPY");
  });

  it("starter prices carry no physio items for non-physio types", () => {
    for (const k of ["DENTAL", "GENERAL"] as const) {
      expect(CLINIC_TYPES[k].starterServices.some((s) => /physio/i.test(s.name))).toBe(false);
    }
  });
});

describe("resolve and selection", () => {
  it("drops unknown stored keys and tolerates null", () => {
    expect([...resolveModules(["opd", "bogus", "billing"])].sort()).toEqual(["billing", "opd"]);
    expect(resolveModules(null).size).toBe(0);
  });

  it("validates admin selections", () => {
    expect(parseSelection(["billing", "opd", "billing"])).toEqual({ ok: true, modules: ["opd", "billing"] });
    expect(parseSelection([])).toEqual({ ok: true, modules: [] });
    expect(parseSelection(["speech_to_rx"]).ok).toBe(false);
    // pharmacy cannot work without stock, so choosing it brings inventory along
    expect(parseSelection(["pharmacy"])).toEqual({ ok: true, modules: ["inventory", "pharmacy"] });
    expect(parseSelection("opd").ok).toBe(false);
    expect(parseSelection([1]).ok).toBe(false);
  });
});

describe("navigation", () => {
  const labels = (role: string, mods?: string[]) => getNavItems(role, mods ? resolveModules(mods) : undefined).map((n) => n.label);

  it("keeps the familiar order when everything is on", () => {
    expect(labels("STAFF", MODULE_KEYS)).toEqual([
      "Dashboard", "Patients", "OPD Queue", "Appointments", "Billing", "Inventory", "Pharmacy", "Staff & Doctors", "Attendance", "Marketing", "Doctor Ratings",
      "Treatment Plans", "Exercise Plans", "Lab", "Imaging", "Admissions", "Help & support",
    ]);
  });

  it("hides disabled modules and always keeps core areas", () => {
    expect(labels("STAFF", ["opd", "billing"])).toEqual(["Dashboard", "Patients", "OPD Queue", "Billing", "Staff & Doctors", "Help & support"]);
    expect(labels("STAFF", [])).toEqual(["Dashboard", "Patients", "Staff & Doctors", "Help & support"]);
  });

  it("shows Price List and Settings only to the clinic admin", () => {
    expect(labels("CLINIC_ADMIN", ["billing"])).toContain("Price List");
    expect(labels("CLINIC_ADMIN", ["billing"])).toContain("Settings");
    expect(labels("STAFF", ["billing"])).not.toContain("Price List");
    expect(labels("DOCTOR", ["billing"])).not.toContain("Settings");
  });

  it("super admin sees every module without a clinic", () => {
    expect(allModules().size).toBe(MODULE_KEYS.length);
    expect(labels("SUPER_ADMIN")).toContain("Clinics");
    expect(labels("SUPER_ADMIN")).toEqual(["Overview", "Clinics", "Support queries", "Platform team"]);
    expect(labels("ONBOARDING")).toEqual(["Clinics", "Support queries"]);
  });
});

describe("clinical suite modules", () => {
  it("discharge brings IPD along; every preset only uses known modules", () => {
    expect(parseSelection(["discharge"])).toEqual({ ok: true, modules: ["ipd", "discharge"] });
    for (const t of Object.values(CLINIC_TYPES)) expect(t.defaultModules.every(isModuleKey)).toBe(true);
  });
});
