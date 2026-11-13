/**
 * Where-clauses that resolve a named row *inside the caller's clinic*.
 *
 * `requireSession` proves who is calling; it says nothing about whether the id
 * in a URL or a request body belongs to that caller's clinic. Any route that
 * takes an id from the request and writes a row that hangs off it must resolve
 * that id through one of these first and 404 when it does not match, or it
 * writes across tenants (see the clinical-note hole fixed on 2026-11-13).
 *
 * These are plain objects on purpose: the where-clause is the security boundary, so it is
 * built here and tested, rather than retyped per route. Older equivalents still live inline
 * (`app/api/visits/route.ts`, `app/api/discharge/[admissionId]/route.ts`) and as per-module
 * `requirePatient` helpers in `lib/dental/db.ts` and `lib/exercise/db.ts`; they are correct,
 * and folding them in here is a separate tidy-up.
 */

/** A patient of this clinic that has not been soft-deleted. */
export function patientInTenant(tenantId: string, patientId: string) {
  return { id: patientId, tenantId, deletedAt: null } as const;
}

/** A doctor of this clinic who can still be booked. */
export function activeDoctorInTenant(tenantId: string, doctorId: string) {
  return { id: doctorId, tenantId, role: "DOCTOR", isActive: true, deletedAt: null } as const;
}

/** Any staff member of this clinic who is still active (doctor, reception or clinic admin). */
export function activeUserInTenant(tenantId: string, userId: string) {
  return { id: userId, tenantId, isActive: true, deletedAt: null } as const;
}
