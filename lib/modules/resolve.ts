import { isModuleKey, MODULE_KEYS, MODULES, type ModuleKey, type NavEntry } from "./registry";

/** Turns whatever is stored on the tenant into a clean set of known module keys. */
export function resolveModules(stored: readonly string[] | null | undefined): Set<ModuleKey> {
  return new Set((stored ?? []).filter(isModuleKey));
}

export const allModules = (): Set<ModuleKey> => new Set(MODULE_KEYS);

export function isModuleOn(modules: ReadonlySet<ModuleKey>, key: ModuleKey) {
  return modules.has(key);
}

/** Validates an admin's selection from the settings page. Unknown keys are rejected, never silently dropped. */
export function parseSelection(input: unknown): { ok: true; modules: ModuleKey[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.some((k) => typeof k !== "string")) {
    return { ok: false, error: "modules must be a list of module keys" };
  }
  const unknown = input.filter((k) => !isModuleKey(k));
  if (unknown.length) return { ok: false, error: `Unknown module: ${unknown[0]}` };
  const unique = [...new Set(input as ModuleKey[])];
  return { ok: true, modules: MODULE_KEYS.filter((k) => unique.includes(k)) };
}

/** Sidebar entries (after Patients) for the modules that are on, in registry order. */
export function moduleNav(modules: ReadonlySet<ModuleKey>, isAdmin: boolean, only?: readonly ModuleKey[]): NavEntry[] {
  return MODULES.filter((m) => modules.has(m.key) && (!only || only.includes(m.key)))
    .flatMap((m) => m.nav)
    .filter((n) => !n.adminOnly || isAdmin);
}
