import { assertModulePage } from "@/lib/modules/guard";

/** Discharge pages need both the discharge and the IPD module; either switched off gives a 404. */
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await assertModulePage("discharge");
  await assertModulePage("ipd");
  return <>{children}</>;
}
