/** Discharge summary state rules (pure). */

export type SummaryCheck = { ok: true } | { ok: false; status: number; error: string };

/** A summary can be edited only while DRAFT, and only once the patient has been discharged. */
export function canEditSummary(admissionStatus: string, summaryStatus: string | null): SummaryCheck {
  if (admissionStatus !== "DISCHARGED") return { ok: false, status: 409, error: "Discharge the patient before writing the summary" };
  if (summaryStatus === "FINAL") return { ok: false, status: 409, error: "This summary is final and can no longer be edited" };
  return { ok: true };
}

export function canFinalize(admissionStatus: string, summaryStatus: string | null, diagnosis: string | null): SummaryCheck {
  if (admissionStatus !== "DISCHARGED") return { ok: false, status: 409, error: "Discharge the patient before finalising the summary" };
  if (summaryStatus === null) return { ok: false, status: 404, error: "Summary not found" };
  if (summaryStatus === "FINAL") return { ok: false, status: 409, error: "This summary is already final" };
  if (!diagnosis?.trim()) return { ok: false, status: 400, error: "Add the diagnosis before finalising" };
  return { ok: true };
}
