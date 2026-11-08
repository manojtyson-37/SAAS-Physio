/** FDI tooth numbering, conditions and surface helpers. Pure functions, no I/O. */

export const ADULT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const;
export const ADULT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const;
export const DECIDUOUS_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65] as const;
export const DECIDUOUS_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75] as const;

export const ADULT_TEETH: readonly number[] = [...ADULT_UPPER, ...ADULT_LOWER];
export const DECIDUOUS_TEETH: readonly number[] = [...DECIDUOUS_UPPER, ...DECIDUOUS_LOWER];

const VALID = new Set<number>([...ADULT_TEETH, ...DECIDUOUS_TEETH]);

export const isValidTooth = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && VALID.has(n);
export const isDeciduous = (n: number) => n >= 51 && n <= 85;

const QUADRANT_NAME: Record<number, string> = { 1: "Upper right", 2: "Upper left", 3: "Lower left", 4: "Lower right" };
/** Quadrant 1-4 (deciduous 5-8 map to 1-4). */
export const quadrantOf = (n: number) => (isDeciduous(n) ? Math.floor(n / 10) - 4 : Math.floor(n / 10));

const ADULT_POS = ["central incisor", "lateral incisor", "canine", "first premolar", "second premolar", "first molar", "second molar", "third molar"];
const DECID_POS = ["central incisor", "lateral incisor", "canine", "first molar", "second molar"];

/** e.g. 16 -> "Upper right first molar"; 54 -> "Upper right primary first molar". */
export function toothName(n: number): string {
  if (!isValidTooth(n)) return `Tooth ${n}`;
  const pos = n % 10;
  const q = QUADRANT_NAME[quadrantOf(n)];
  return isDeciduous(n) ? `${q} primary ${DECID_POS[pos - 1]}` : `${q} ${ADULT_POS[pos - 1]}`;
}

export const CONDITIONS = ["HEALTHY", "CARIES", "FILLED", "CROWN", "ROOT_CANAL", "IMPLANT", "FRACTURED", "MISSING", "EXTRACTED", "OTHER"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_STYLE: Record<Condition, { label: string; fill: string; stroke: string; text: string }> = {
  HEALTHY: { label: "Healthy", fill: "#ffffff", stroke: "#9ca3af", text: "#374151" },
  CARIES: { label: "Caries", fill: "#f87171", stroke: "#b91c1c", text: "#450a0a" },
  FILLED: { label: "Filled", fill: "#60a5fa", stroke: "#1d4ed8", text: "#0c1e4a" },
  CROWN: { label: "Crown", fill: "#fbbf24", stroke: "#b45309", text: "#451a03" },
  ROOT_CANAL: { label: "Root canal", fill: "#c084fc", stroke: "#7e22ce", text: "#2e0a4a" },
  IMPLANT: { label: "Implant", fill: "#2dd4bf", stroke: "#0f766e", text: "#042f2e" },
  FRACTURED: { label: "Fractured", fill: "#fb923c", stroke: "#c2410c", text: "#431407" },
  MISSING: { label: "Missing", fill: "#e5e7eb", stroke: "#9ca3af", text: "#6b7280" },
  EXTRACTED: { label: "Extracted", fill: "#d1d5db", stroke: "#6b7280", text: "#374151" },
  OTHER: { label: "Other", fill: "#a3e635", stroke: "#4d7c0f", text: "#1a2e05" },
};

export const SURFACE_ORDER = ["M", "O", "D", "B", "L", "I"] as const;
export const SURFACE_NAMES: Record<string, string> = { M: "Mesial", O: "Occlusal", D: "Distal", B: "Buccal", L: "Lingual", I: "Incisal" };

/** Canonical surface string ("MOD"), null for none/blank; undefined when it holds an invalid letter. */
export function normalizeSurfaces(input: string | null | undefined): string | null | undefined {
  const s = (input ?? "").toUpperCase().replace(/[\s,]/g, "");
  if (s === "") return null;
  for (const ch of s) if (!(SURFACE_ORDER as readonly string[]).includes(ch)) return undefined;
  return SURFACE_ORDER.filter((l) => s.includes(l)).join("");
}

export type ChartRecord = { id: string; tooth: number; createdAt: Date | string; condition: string; surfaces: string | null; notes: string | null };

/** Current state per tooth = the newest record for that tooth (ties broken by id so the result is deterministic). */
export function currentState<T extends ChartRecord>(records: T[]): Map<number, T> {
  const out = new Map<number, T>();
  for (const r of records) {
    const cur = out.get(r.tooth);
    if (!cur) { out.set(r.tooth, r); continue; }
    const a = new Date(r.createdAt).getTime();
    const b = new Date(cur.createdAt).getTime();
    if (a > b || (a === b && r.id > cur.id)) out.set(r.tooth, r);
  }
  return out;
}
