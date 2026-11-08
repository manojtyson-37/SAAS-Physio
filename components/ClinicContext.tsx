"use client";

import { createContext, useContext } from "react";

export type ClinicInfo = {
  clinicType: string;
  clinicTypeLabel: string;
  modules: string[];
  terms: { package: string; packages: string };
  specialties: string[];
  appointmentMinutes: number;
  /** True for the clinic admin (and the platform admin): the only roles allowed to remove or revoke records. */
  isAdmin: boolean;
  /** True for the platform owner: the Overview page shows ClinicOS-level numbers, never clinic data. */
  isPlatform: boolean;
};

const FALLBACK: ClinicInfo = {
  clinicType: "PHYSIOTHERAPY",
  clinicTypeLabel: "Clinic",
  modules: [],
  terms: { package: "Package", packages: "Packages" },
  specialties: [],
  appointmentMinutes: 30,
  isAdmin: false,
  isPlatform: false,
};

const Ctx = createContext<ClinicInfo>(FALLBACK);

export function ClinicProvider({ value, children }: { value: ClinicInfo; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useClinic = () => useContext(Ctx);
export const useHasModule = (key: string) => useContext(Ctx).modules.includes(key);
export const useIsAdmin = () => useContext(Ctx).isAdmin;
