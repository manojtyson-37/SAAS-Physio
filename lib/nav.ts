export type NavItem = { label: string; href: string };

export function getNavItems(role: string): NavItem[] {
  const base: NavItem[] = [
    { label: role === "SUPER_ADMIN" ? "Overview" : "Dashboard", href: "/app" },
  ];

  if (role === "SUPER_ADMIN") {
    base.push({ label: "Clinics", href: "/app/clinics" });
  }

  base.push(
    { label: "Patients", href: "/app/patients" },
    { label: "OPD Queue", href: "/app/opd" },
    { label: "Appointments", href: "/app/appointments" },
    { label: "Billing", href: "/app/invoices" },
    { label: "Staff & Doctors", href: "/app/staff" },
    { label: "Attendance", href: "/app/attendance" },
    { label: "Marketing", href: "/app/marketing" },
    { label: "Doctor Ratings", href: "/app/ratings" }
  );

  return base;
}
