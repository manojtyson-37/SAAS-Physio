import { CLINIC_TYPES, type ClinicTypeKey } from "@/lib/modules/clinicTypes";
import { subscriptionView } from "./subscription";

type T = {
  id: string; name: string; clinicType: string; facilityType: string; phone: string | null; email: string | null; address: string | null; gstNumber: string | null;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED"; plan: string | null; trialStartedAt: Date | null; trialEndsAt: Date | null; paidThrough: Date | null;
  subscriptionNote: string | null; selfServiceModules: boolean; enabledModules: string[]; createdAt: Date;
};

export const clinicView = (t: T, now = new Date()) => {
  const sub = subscriptionView({ status: t.subscriptionStatus, trialEndsAt: t.trialEndsAt, paidThrough: t.paidThrough }, now);
  return {
    id: t.id, name: t.name, clinicType: t.clinicType, clinicTypeLabel: CLINIC_TYPES[t.clinicType as ClinicTypeKey]?.label ?? t.clinicType,
    phone: t.phone, email: t.email, address: t.address, gstNumber: t.gstNumber, createdAt: t.createdAt,
    subscription: {
      status: t.subscriptionStatus, state: sub.state, access: sub.access, daysLeft: sub.daysLeft, plan: t.plan,
      trialStartedAt: t.trialStartedAt, trialEndsAt: t.trialEndsAt, paidThrough: t.paidThrough, note: t.subscriptionNote,
    },
    modules: t.enabledModules, selfServiceModules: t.selfServiceModules,
  };
};

export const TENANT_SELECT = {
  id: true, name: true, clinicType: true, facilityType: true, phone: true, email: true, address: true, gstNumber: true,
  subscriptionStatus: true, plan: true, trialStartedAt: true, trialEndsAt: true, paidThrough: true, subscriptionNote: true,
  selfServiceModules: true, enabledModules: true, createdAt: true,
} as const;
