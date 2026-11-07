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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const modules = await getEnabledModules(session);
  const items = getNavItems(session.role, modules);
  const tenant = session.tenantId
    ? await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { clinicType: true } })
    : null;
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
      }}
    >
    <div className="flex min-h-screen bg-cream">
      <Sidebar items={items} userName={session.name} roleLabel={roleLabel(session.role)} />
      <div className="flex flex-1 flex-col">
        <TopBar userFirstName={session.name.split(" ")[0]} />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
    </ClinicProvider>
  );
}
