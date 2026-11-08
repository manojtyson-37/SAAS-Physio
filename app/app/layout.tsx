import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNavItems } from "@/lib/nav";
import { roleLabel } from "@/lib/roleLabel";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ClinicProvider } from "@/components/ClinicContext";
import { prisma } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules/guard";
import { clinicTypeDef } from "@/lib/modules/clinicTypes";
import { AccessEnded, ForcePasswordChange } from "@/components/account/AccountGates";
import { bannerText, subscriptionView } from "@/lib/platform/subscription";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Re-read the user and clinic: a signed cookie alone must not keep a deactivated user or a suspended clinic inside.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isActive: true, deletedAt: true, mustChangePassword: true, tenantId: true, role: true },
  });
  if (!user || !user.isActive || user.deletedAt || user.role !== session.role || user.tenantId !== session.tenantId) {
    return <AccessEnded title="Access ended" body="This login is no longer active. Please contact your clinic admin." />;
  }
  if (user.mustChangePassword) return <ForcePasswordChange />;

  const tenant = session.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.tenantId },
        select: { clinicType: true, deletedAt: true, subscriptionStatus: true, trialEndsAt: true, paidThrough: true },
      })
    : null;
  if (session.tenantId && (!tenant || tenant.deletedAt)) {
    return <AccessEnded title="Clinic not found" body="This clinic account is no longer available. Please contact ClinicOS support." />;
  }
  const sub = tenant ? subscriptionView({ status: tenant.subscriptionStatus, trialEndsAt: tenant.trialEndsAt, paidThrough: tenant.paidThrough }) : null;
  if (sub?.access === "BLOCKED") {
    return <AccessEnded title="Account suspended" body="This clinic's ClinicOS account is suspended. Please contact ClinicOS support to restore access." />;
  }
  const banner = sub ? bannerText(sub) : null;

  const modules = await getEnabledModules(session);
  const items = getNavItems(session.role, modules);
  const type = clinicTypeDef(tenant?.clinicType);

  return (
    <ClinicProvider
      value={{
        clinicType: type.key,
        clinicTypeLabel: tenant ? type.label : "Platform admin",
        modules: [...modules],
        terms: type.terms,
        specialties: type.specialties,
        appointmentMinutes: type.appointmentMinutes,
        isAdmin: session.role === "CLINIC_ADMIN" || session.role === "SUPER_ADMIN",
      }}
    >
    <div className="flex min-h-screen bg-cream">
      <Sidebar items={items} userName={session.name} roleLabel={roleLabel(session.role)} />
      <div className="flex flex-1 flex-col">
        <TopBar userFirstName={session.name.split(" ")[0]} />
        {banner && (
          <p role="status" className={`border-b border-sand px-8 py-2 text-sm ${sub?.access === "READ_ONLY" ? "bg-clay-light text-clay" : "bg-forest/10 text-forest"}`}>{banner} Questions? Contact ClinicOS support.</p>
        )}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
    </ClinicProvider>
  );
}
