/**
 * Module registry: the single list of everything a clinic can switch on or off.
 * Core areas (dashboard, patients, staff) are always on and are not listed here.
 * Adding a module = one entry here, a gate on its pages (layout) and APIs, and it shows up in
 * the admin settings page and in the clinic-type presets automatically.
 */
export type ModuleKey =
  | "appointments"
  | "opd"
  | "billing"
  | "packages"
  | "attendance"
  | "marketing"
  | "ratings"
  | "inventory"
  | "pharmacy"
  | "dental_chart"
  | "exercise_plans"
  | "lab"
  | "radiology"
  | "ipd"
  | "discharge";

export type ModuleGroup = "Clinical" | "Front desk" | "Finance" | "People" | "Growth";

export type NavEntry = { label: string; href: string; adminOnly?: boolean };

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  description: string;
  group: ModuleGroup;
  /** Sidebar entries this module adds, in menu order. */
  nav: NavEntry[];
  /** URL prefixes under /app that belong to this module (their pages return 404 when it is off). */
  pagePrefixes: string[];
  /** Modules that must be on for this one to work; switching this on switches them on too. */
  requires?: ModuleKey[];
};

export const MODULES: ModuleDef[] = [
  {
    key: "opd",
    label: "OPD queue & prescriptions",
    description: "Walk-in token queue, vitals, consultation notes and printable prescriptions.",
    group: "Clinical",
    nav: [{ label: "OPD Queue", href: "/app/opd" }],
    pagePrefixes: ["/app/opd"],
  },
  {
    key: "appointments",
    label: "Appointments",
    description: "Book and manage scheduled appointments by doctor.",
    group: "Front desk",
    nav: [{ label: "Appointments", href: "/app/appointments" }],
    pagePrefixes: ["/app/appointments"],
  },
  {
    key: "billing",
    label: "Billing & price list",
    description: "Invoices, partial payments, GST, price list and the day-end collection report.",
    group: "Finance",
    nav: [
      { label: "Billing", href: "/app/invoices" },
      { label: "Price List", href: "/app/services", adminOnly: true },
    ],
    pagePrefixes: ["/app/invoices", "/app/services"],
  },
  {
    key: "packages",
    label: "Treatment packages",
    description: "Sell multi-visit packages or plans and track the sessions used.",
    group: "Clinical",
    nav: [],
    pagePrefixes: [],
  },
  {
    key: "attendance",
    label: "Attendance",
    description: "Daily staff and patient attendance.",
    group: "People",
    nav: [{ label: "Attendance", href: "/app/attendance" }],
    pagePrefixes: ["/app/attendance"],
  },
  {
    key: "marketing",
    label: "Marketing & referrals",
    description: "Campaigns, referral tracking and lead-source reporting.",
    group: "Growth",
    nav: [{ label: "Marketing", href: "/app/marketing" }],
    pagePrefixes: ["/app/marketing"],
  },
  {
    key: "ratings",
    label: "Doctor ratings",
    description: "Collect patient ratings and compare doctors.",
    group: "Growth",
    nav: [{ label: "Doctor Ratings", href: "/app/ratings" }],
    pagePrefixes: ["/app/ratings"],
  },
  {
    key: "inventory",
    label: "Inventory & stock",
    description: "Medicines and consumables with batch and expiry, suppliers, stock receipts and low-stock alerts.",
    group: "Clinical",
    nav: [{ label: "Inventory", href: "/app/inventory" }],
    pagePrefixes: ["/app/inventory"],
  },
  {
    key: "pharmacy",
    label: "Pharmacy & dispensing",
    description: "Dispense a prescription or sell over the counter, oldest-expiry batch first, with an invoice.",
    group: "Clinical",
    nav: [{ label: "Pharmacy", href: "/app/pharmacy" }],
    pagePrefixes: ["/app/pharmacy"],
    requires: ["inventory"],
  },
  {
    key: "dental_chart",
    label: "Dental chart & treatment plans",
    description: "Tooth chart (FDI), findings per tooth and staged treatment plans with prices that can be billed.",
    group: "Clinical",
    nav: [{ label: "Treatment Plans", href: "/app/dental" }],
    pagePrefixes: ["/app/dental"],
  },
  {
    key: "exercise_plans",
    label: "Exercise & rehab plans",
    description: "Prescribe home exercise programmes from a library and track pain and adherence over time.",
    group: "Clinical",
    nav: [{ label: "Exercise Plans", href: "/app/exercise" }],
    pagePrefixes: ["/app/exercise"],
  },
  {
    key: "lab",
    label: "Pathology lab",
    description: "Test catalogue with reference ranges, orders, sample tracking, result entry with flags and printable reports.",
    group: "Clinical",
    nav: [{ label: "Lab", href: "/app/lab" }],
    pagePrefixes: ["/app/lab"],
  },
  {
    key: "radiology",
    label: "Radiology & imaging",
    description: "Imaging orders (X-ray, ultrasound, CT, MRI, ECG), scheduling and printable reports.",
    group: "Clinical",
    nav: [{ label: "Imaging", href: "/app/radiology" }],
    pagePrefixes: ["/app/radiology"],
  },
  {
    key: "ipd",
    label: "IPD, ICU & bed management",
    description: "Wards and beds, admissions, transfers, nursing notes and ICU charting, with bed charges billed at discharge.",
    group: "Clinical",
    nav: [{ label: "Admissions", href: "/app/ipd" }],
    pagePrefixes: ["/app/ipd"],
  },
  {
    key: "discharge",
    label: "Discharge summary",
    description: "Discharge summary prefilled from the admission, lab and imaging record, finalised and printable.",
    group: "Clinical",
    nav: [],
    pagePrefixes: ["/app/discharge"],
    requires: ["ipd"],
  },
];

/** Planned modules, shown on the settings page as "Coming soon" and not switchable yet. */
export type PlannedModule = { key: string; label: string; description: string; group: ModuleGroup };

export const PLANNED_MODULES: PlannedModule[] = [
  { key: "speech_to_rx", label: "Speech-to-Rx", description: "Dictate or hand-write a prescription on a tablet and have it structured for you.", group: "Clinical" },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
export const isModuleKey = (k: string): k is ModuleKey => (MODULE_KEYS as string[]).includes(k);
export const getModule = (k: ModuleKey) => MODULES.find((m) => m.key === k)!;

/** Which module (if any) owns a path under /app. */
export function moduleForPath(pathname: string): ModuleKey | null {
  for (const m of MODULES) {
    if (m.pagePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return m.key;
  }
  return null;
}
