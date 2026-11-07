"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PulseMark } from "@/components/PulseMark";
import { NavItem } from "@/lib/nav";
import { BRAND } from "@/lib/brand";
import { useClinic } from "@/components/ClinicContext";

export function Sidebar({
  items,
  userName,
  roleLabel,
}: {
  items: NavItem[];
  userName: string;
  roleLabel: string;
}) {
  const clinic = useClinic();
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sand bg-white/60 px-4 py-5">
      <div className="flex items-center gap-2 px-2">
        <PulseMark className="h-8 w-8" />
        <div className="leading-tight">
          <div className="font-display text-base font-medium">{BRAND.name}</div>
          <div className="font-data text-[9px] uppercase tracking-[0.18em] text-sage">
            {clinic.clinicTypeLabel}
          </div>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-forest text-cream"
                  : "text-ink/70 hover:bg-sand/60 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sand pt-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-light font-data text-xs font-semibold text-clay">
            {userName
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">{userName}</div>
            <div className="text-xs text-ink/50">{roleLabel}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm text-ink/60 hover:bg-sand/60 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
