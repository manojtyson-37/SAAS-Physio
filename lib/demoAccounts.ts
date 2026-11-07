/** Demo logins shown on the sign-in page. All demo accounts share one password (see README). */
export const DEMO_PASSWORD = "Admin@123";

export type DemoGroup = { clinic: string; type: string; accounts: { label: string; email: string }[] };

export const DEMO_GROUPS: DemoGroup[] = [
  {
    clinic: "Sunrise Physiotherapy",
    type: "Physiotherapy clinic",
    accounts: [
      { label: "Clinic admin", email: "admin@sunrisephysio.in" },
      { label: "Doctor", email: "dr.arjun@sunrisephysio.in" },
      { label: "Reception", email: "reception@sunrisephysio.in" },
    ],
  },
  {
    clinic: "BrightSmile Dental Studio",
    type: "Dental clinic",
    accounts: [
      { label: "Clinic admin", email: "admin@brightsmile.demo" },
      { label: "Dentist", email: "dr.aditya@brightsmile.demo" },
      { label: "Reception", email: "reception@brightsmile.demo" },
    ],
  },
  {
    clinic: "CityCare Family Clinic",
    type: "General clinic",
    accounts: [
      { label: "Clinic admin", email: "admin@citycare.demo" },
      { label: "Doctor", email: "dr.imran@citycare.demo" },
      { label: "Reception", email: "reception@citycare.demo" },
    ],
  },
  {
    clinic: "BoneWell Ortho & Joint Care",
    type: "Orthopaedic clinic",
    accounts: [
      { label: "Clinic admin", email: "admin@bonewell.demo" },
      { label: "Doctor", email: "dr.suresh@bonewell.demo" },
      { label: "Reception", email: "reception@bonewell.demo" },
    ],
  },
  {
    clinic: "Lakeview Multispeciality Hospital",
    type: "Small hospital",
    accounts: [
      { label: "Hospital admin", email: "admin@lakeview.demo" },
      { label: "Doctor", email: "dr.anita@lakeview.demo" },
      { label: "Reception", email: "reception@lakeview.demo" },
    ],
  },
];

export const SUPER_ADMIN_DEMO = { label: "Platform super admin", email: "superadmin@physiocare.io" };
