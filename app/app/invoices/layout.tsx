import { assertModulePage } from "@/lib/modules/guard";

/** Pages of a module that is switched off for this clinic return 404. */
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await assertModulePage("billing");
  return <>{children}</>;
}
