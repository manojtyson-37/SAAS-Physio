/** Pure assembly of the discharge-summary prefill from the record of the stay. */

export type PrefillInput = {
  admission: { diagnosis: string | null; reason: string | null };
  labs?: { testName: string; resultValue: string; unit: string | null; flag: string | null }[];
  imaging?: { studyName: string; impression: string }[];
  rx?: { genericName: string; brandName: string | null; strength: string | null; form: string | null; dose: string | null; frequency: string; durationDays: number | null; instructions: string | null }[];
};

export type Prefill = {
  diagnosis: string;
  courseInHospital: string;
  investigationsSummary: string;
  medicationsOnDischarge: string;
};

export function rxLine(i: NonNullable<PrefillInput["rx"]>[number]): string {
  const name = [i.brandName || i.genericName, i.strength, i.form].filter(Boolean).join(" ");
  const how = [i.dose, i.frequency, i.durationDays ? `for ${i.durationDays} days` : null].filter(Boolean).join(", ");
  return `${name} - ${how}${i.instructions ? ` (${i.instructions})` : ""}`;
}

export function buildPrefill(p: PrefillInput): Prefill {
  const labLines = (p.labs ?? []).map((l) => `${l.testName}: ${l.resultValue}${l.unit ? ` ${l.unit}` : ""}${l.flag && l.flag !== "NORMAL" ? ` [${l.flag}]` : ""}`);
  const imgLines = (p.imaging ?? []).map((i) => `${i.studyName}: ${i.impression}`);
  const inv = [...(labLines.length ? ["Laboratory", ...labLines] : []), ...(imgLines.length ? ["Imaging", ...imgLines] : [])];
  return {
    diagnosis: p.admission.diagnosis ?? "",
    courseInHospital: p.admission.reason ? `Admitted for: ${p.admission.reason}` : "",
    investigationsSummary: inv.join("\n"),
    medicationsOnDischarge: (p.rx ?? []).map((i, n) => `${n + 1}. ${rxLine(i)}`).join("\n"),
  };
}
