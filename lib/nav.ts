import { allModules, moduleNav } from "@/lib/modules/resolve";
import type { ModuleKey } from "@/lib/modules/registry";

export type NavItem = { label: string; href: string };

// Modules that sit above "Staff & Doctors" in the menu; the rest sit below it.
const FRONT: ModuleKey[] = ["opd", "appointments", "billing", "pharmacy", "inventory"];

/**
 * `modules` is the clinic's enabled set. SUPER_ADMIN has no clinic, so sees every module (platform view).
 */
export function getNavItems(role: string, modules?: ReadonlySet<ModuleKey>): NavItem[] {
  const on = role === "SUPER_ADMIN" || !modules ? allModules() : modules;
  const isAdmin = role === "CLINIC_ADMIN" || role === "SUPER_ADMIN";
  const back = [...on].filter((k) => !FRONT.includes(k));

  const items: NavItem[] = [
    { label: role === "SUPER_ADMIN" ? "Overview" : "Dashboard", href: "/app" },
  ];
  if (role === "SUPER_ADMIN") items.push({ label: "Clinics", href: "/app/clinics" });

  items.push({ label: "Patients", href: "/app/patients" });
  items.push(...moduleNav(on, isAdmin, FRONT));
  items.push({ label: "Staff & Doctors", href: "/app/staff" });
  items.push(...moduleNav(on, isAdmin, back));
  if (role === "CLINIC_ADMIN") items.push({ label: "Settings", href: "/app/settings" });
  return items;
}
