import { allModules, moduleNav } from "@/lib/modules/resolve";
import type { ModuleKey } from "@/lib/modules/registry";

export type NavItem = { label: string; href: string };

// Modules that sit above "Staff & Doctors" in the menu; the rest sit below it.
const FRONT: ModuleKey[] = ["opd", "appointments", "billing", "pharmacy", "inventory"];

/**
 * `modules` is the clinic's enabled set. SUPER_ADMIN has no clinic, so sees every module (platform view).
 */
export function getNavItems(role: string, modules?: ReadonlySet<ModuleKey>): NavItem[] {
  // The onboarding team only has the platform console.
  if (role === "ONBOARDING") return [{ label: "Clinics", href: "/app/platform" }, { label: "Support queries", href: "/app/platform/support" }];
  // The platform owner has no clinic: only the platform pages are useful (clinic data stays inside each clinic).
  if (role === "SUPER_ADMIN") return [{ label: "Overview", href: "/app" }, { label: "Clinics", href: "/app/platform" }, { label: "Support queries", href: "/app/platform/support" }, { label: "Platform team", href: "/app/platform/team" }];
  const on = role === "SUPER_ADMIN" || !modules ? allModules() : modules;
  const isAdmin = role === "CLINIC_ADMIN" || role === "SUPER_ADMIN";
  const back = [...on].filter((k) => !FRONT.includes(k));

  const items: NavItem[] = [
    { label: role === "SUPER_ADMIN" ? "Overview" : "Dashboard", href: "/app" },
  ];
  if (role === "SUPER_ADMIN") {
    items.push({ label: "Clinics", href: "/app/platform" });
    items.push({ label: "Platform team", href: "/app/platform/team" });
  }

  items.push({ label: "Patients", href: "/app/patients" });
  items.push(...moduleNav(on, isAdmin, FRONT));
  items.push({ label: "Staff & Doctors", href: "/app/staff" });
  items.push(...moduleNav(on, isAdmin, back));
  if (role === "CLINIC_ADMIN") items.push({ label: "Settings", href: "/app/settings" });
  items.push({ label: "Help & support", href: "/app/support" });
  return items;
}
