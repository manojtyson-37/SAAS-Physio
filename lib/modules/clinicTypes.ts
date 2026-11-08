import type { ModuleKey } from "./registry";

export type ClinicTypeKey = "PHYSIOTHERAPY" | "DENTAL" | "GENERAL" | "ORTHO" | "HOSPITAL";

export type StarterService = { name: string; category: string; price: string };

export type ClinicTypeDef = {
  key: ClinicTypeKey;
  label: string;
  blurb: string;
  facility: "CLINIC" | "HOSPITAL";
  defaultModules: ModuleKey[];
  specialties: string[];
  appointmentMinutes: number;
  /** Wording that changes by clinic type. */
  terms: { package: string; packages: string };
  starterServices: StarterService[];
};

const svc = (name: string, category: string, price: number): StarterService => ({
  name,
  category,
  price: price.toFixed(2),
});

export const CLINIC_TYPES: Record<ClinicTypeKey, ClinicTypeDef> = {
  PHYSIOTHERAPY: {
    key: "PHYSIOTHERAPY",
    label: "Physiotherapy clinic",
    blurb: "Session-based rehab with packages and attendance.",
    facility: "CLINIC",
    defaultModules: ["opd", "appointments", "billing", "exercise_plans", "packages", "attendance", "marketing", "ratings"],
    specialties: ["Sports Physiotherapy", "Musculoskeletal", "Neuro Rehabilitation", "Paediatric Physiotherapy", "Cardiopulmonary Rehabilitation"],
    appointmentMinutes: 45,
    terms: { package: "Therapy package", packages: "Therapy packages" },
    starterServices: [
      svc("Consultation", "Consultation", 500),
      svc("Follow-up consultation", "Consultation", 300),
      svc("Initial assessment", "Consultation", 1000),
      svc("Physiotherapy session", "Therapy", 800),
      svc("Ultrasound therapy", "Therapy", 400),
      svc("TENS / electrotherapy", "Therapy", 300),
      svc("Dry needling", "Procedure", 600),
      svc("Kinesio taping", "Procedure", 250),
      svc("Home visit", "Other", 1500),
    ],
  },
  DENTAL: {
    key: "DENTAL",
    label: "Dental clinic",
    blurb: "Chair-time appointments, treatment plans and procedures.",
    facility: "CLINIC",
    defaultModules: ["appointments", "opd", "billing", "inventory", "dental_chart", "packages", "attendance", "marketing", "ratings"],
    specialties: ["General Dentistry", "Endodontics", "Orthodontics", "Periodontics", "Oral Surgery", "Paedodontics", "Prosthodontics"],
    appointmentMinutes: 30,
    terms: { package: "Treatment plan", packages: "Treatment plans" },
    starterServices: [
      svc("Dental consultation", "Consultation", 300),
      svc("Scaling & polishing", "Procedure", 1200),
      svc("Composite filling", "Procedure", 1500),
      svc("Root canal treatment", "Procedure", 6500),
      svc("Tooth extraction", "Procedure", 800),
      svc("Zirconia crown", "Procedure", 9000),
      svc("Teeth whitening", "Procedure", 6000),
      svc("Intraoral X-ray (IOPA)", "Radiology", 250),
      svc("Orthodontic adjustment", "Procedure", 1500),
    ],
  },
  GENERAL: {
    key: "GENERAL",
    label: "General clinic",
    blurb: "Walk-in OPD, prescriptions and quick billing.",
    facility: "CLINIC",
    defaultModules: ["opd", "appointments", "billing", "inventory", "pharmacy", "lab", "attendance", "ratings"],
    specialties: ["General Medicine", "Family Medicine", "Paediatrics", "Gynaecology", "Dermatology"],
    appointmentMinutes: 15,
    terms: { package: "Health package", packages: "Health packages" },
    starterServices: [
      svc("Consultation", "Consultation", 400),
      svc("Follow-up consultation", "Consultation", 200),
      svc("Dressing", "Procedure", 250),
      svc("Injection administration", "Procedure", 100),
      svc("ECG", "Lab", 350),
      svc("Nebulisation", "Procedure", 200),
      svc("Basic health check-up", "Other", 1500),
    ],
  },
  ORTHO: {
    key: "ORTHO",
    label: "Orthopaedic clinic",
    blurb: "Joint and bone care with imaging, procedures and rehab plans.",
    facility: "CLINIC",
    defaultModules: ["appointments", "opd", "billing", "inventory", "pharmacy", "radiology", "exercise_plans", "packages", "attendance", "ratings"],
    specialties: ["Orthopaedics", "Joint Replacement", "Spine", "Sports Injury", "Paediatric Orthopaedics", "Trauma"],
    appointmentMinutes: 20,
    terms: { package: "Rehab plan", packages: "Rehab plans" },
    starterServices: [
      svc("Orthopaedic consultation", "Consultation", 700),
      svc("Follow-up consultation", "Consultation", 400),
      svc("X-ray (per view)", "Radiology", 400),
      svc("Plaster / cast application", "Procedure", 1200),
      svc("Intra-articular injection", "Procedure", 2500),
      svc("Splint / brace fitting", "Procedure", 1800),
      svc("Physiotherapy session", "Therapy", 700),
    ],
  },
  HOSPITAL: {
    key: "HOSPITAL",
    label: "Small hospital",
    blurb: "Multi-doctor OPD with billing; ready for IPD, lab and pharmacy modules as they ship.",
    facility: "HOSPITAL",
    defaultModules: ["opd", "appointments", "billing", "inventory", "pharmacy", "lab", "radiology", "ipd", "discharge", "attendance", "marketing", "ratings"],
    specialties: ["General Medicine", "General Surgery", "Orthopaedics", "Obstetrics & Gynaecology", "Paediatrics", "Emergency Medicine"],
    appointmentMinutes: 15,
    terms: { package: "Health package", packages: "Health packages" },
    starterServices: [
      svc("OPD consultation", "Consultation", 500),
      svc("Specialist consultation", "Consultation", 900),
      svc("Emergency consultation", "Consultation", 1000),
      svc("ECG", "Lab", 400),
      svc("Dressing", "Procedure", 300),
      svc("Minor procedure", "Procedure", 2500),
      svc("Health check-up package", "Other", 2999),
    ],
  },
};

export const CLINIC_TYPE_KEYS = Object.keys(CLINIC_TYPES) as ClinicTypeKey[];
export const isClinicType = (k: string): k is ClinicTypeKey => k in CLINIC_TYPES;
export const clinicTypeDef = (k: string | null | undefined): ClinicTypeDef =>
  isClinicType(k ?? "") ? CLINIC_TYPES[k as ClinicTypeKey] : CLINIC_TYPES.PHYSIOTHERAPY;
