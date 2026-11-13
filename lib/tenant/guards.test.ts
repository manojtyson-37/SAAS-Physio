import { describe, expect, it } from "vitest";
import { activeDoctorInTenant, activeUserInTenant, patientInTenant } from "./guards";

/**
 * A stand-in for Prisma's filtering, so these tests exercise the where-clause as
 * a filter rather than only comparing it to a literal. Equality only, which is
 * all these clauses use.
 */
type Row = Record<string, unknown>;
function rowsMatching(rows: Row[], where: Row): Row[] {
  return rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
}

const CLINIC_A = "tenant-a";
const CLINIC_B = "tenant-b";

const patients: Row[] = [
  { id: "p-own", tenantId: CLINIC_A, deletedAt: null, name: "Own patient" },
  { id: "p-own-deleted", tenantId: CLINIC_A, deletedAt: new Date(), name: "Discharged record" },
  { id: "p-other", tenantId: CLINIC_B, deletedAt: null, name: "Another clinic's patient" },
];

const users: Row[] = [
  { id: "d-own", tenantId: CLINIC_A, role: "DOCTOR", isActive: true, deletedAt: null },
  { id: "d-own-inactive", tenantId: CLINIC_A, role: "DOCTOR", isActive: false, deletedAt: null },
  { id: "s-own", tenantId: CLINIC_A, role: "STAFF", isActive: true, deletedAt: null },
  { id: "d-other", tenantId: CLINIC_B, role: "DOCTOR", isActive: true, deletedAt: null },
];

describe("patientInTenant", () => {
  it("finds the clinic's own patient", () => {
    expect(rowsMatching(patients, patientInTenant(CLINIC_A, "p-own"))).toHaveLength(1);
  });

  // The hole this guard closes: a patient id is not secret (it sits in URLs, invoices
  // and screenshots), so a clinic user can send another clinic's id and must get nothing.
  it("finds nothing for a patient of another clinic", () => {
    expect(rowsMatching(patients, patientInTenant(CLINIC_A, "p-other"))).toHaveLength(0);
  });

  it("finds nothing for a soft-deleted patient", () => {
    expect(rowsMatching(patients, patientInTenant(CLINIC_A, "p-own-deleted"))).toHaveLength(0);
  });

  it("pins the tenant, so the clause cannot be satisfied by the id alone", () => {
    expect(patientInTenant(CLINIC_A, "p-own")).toEqual({ id: "p-own", tenantId: CLINIC_A, deletedAt: null });
  });
});

describe("activeDoctorInTenant", () => {
  it("finds an active doctor of the clinic", () => {
    expect(rowsMatching(users, activeDoctorInTenant(CLINIC_A, "d-own"))).toHaveLength(1);
  });

  it("finds nothing for a doctor of another clinic", () => {
    expect(rowsMatching(users, activeDoctorInTenant(CLINIC_A, "d-other"))).toHaveLength(0);
  });

  it("finds nothing for a deactivated doctor", () => {
    expect(rowsMatching(users, activeDoctorInTenant(CLINIC_A, "d-own-inactive"))).toHaveLength(0);
  });

  it("finds nothing when the user is not a doctor", () => {
    expect(rowsMatching(users, activeDoctorInTenant(CLINIC_A, "s-own"))).toHaveLength(0);
  });
});

describe("activeUserInTenant", () => {
  it("finds any active staff member of the clinic", () => {
    expect(rowsMatching(users, activeUserInTenant(CLINIC_A, "s-own"))).toHaveLength(1);
    expect(rowsMatching(users, activeUserInTenant(CLINIC_A, "d-own"))).toHaveLength(1);
  });

  it("finds nothing for a staff member of another clinic", () => {
    expect(rowsMatching(users, activeUserInTenant(CLINIC_A, "d-other"))).toHaveLength(0);
  });

  it("finds nothing for a deactivated staff member", () => {
    expect(rowsMatching(users, activeUserInTenant(CLINIC_A, "d-own-inactive"))).toHaveLength(0);
  });
});
