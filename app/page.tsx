import Link from "next/link";
import { PulseMark } from "@/components/PulseMark";
import { BRAND } from "@/lib/brand";
import { CLINIC_TYPES, CLINIC_TYPE_KEYS } from "@/lib/modules/clinicTypes";
import { MODULES, getModule } from "@/lib/modules/registry";

const FEATURES = [
  {
    title: "Patient records",
    body: "One chart per patient: UHID, history, vitals, notes, prescriptions and bills together.",
  },
  {
    title: "OPD queue & prescriptions",
    body: "Token queue, vitals, consultation and printable prescriptions with generic names.",
  },
  {
    title: "Appointments",
    body: "Multi-doctor, multi-branch scheduling with slot lengths that fit your specialty.",
  },
  {
    title: "Billing & GST",
    body: "Price list, one-click invoices, part-payments across cash, UPI and card, and a day-end report.",
  },
  {
    title: "Packages & treatment plans",
    body: "Sell multi-visit plans, track sessions used and what is left.",
  },
  {
    title: "Analytics that adapt",
    body: "The dashboard shows only what your clinic has switched on: queue, collections, dues, doctors.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-sand/80 bg-cream/90 px-6 py-4 backdrop-blur sm:px-10">
        <div className="flex items-center gap-2.5">
          <PulseMark className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-display text-lg font-medium">{BRAND.name}</div>
            <div className="font-data text-[10px] uppercase tracking-[0.18em] text-sage">
              {BRAND.descriptor}
            </div>
          </div>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-ink/70 md:flex">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#modules" className="hover:text-ink">Modules</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
        </nav>
        <Link
          href="/login"
          className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-cream transition hover:bg-forest-deep"
        >
          Sign in
        </Link>
      </header>

      <section className="grid gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
        <div>
          <p className="font-data text-xs uppercase tracking-[0.2em] text-clay">
            Built for clinics &amp; small hospitals
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] font-medium sm:text-5xl lg:text-6xl">
            Run your entire clinic —
            <br />
            <em className="italic text-forest">front desk to follow-up.</em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink/70 sm:text-lg">
            {BRAND.name} is the modular workspace for physiotherapy, dental,
            orthopaedic and general clinics and small hospitals. Switch on only
            the modules you need: OPD, appointments, billing, packages and more.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-forest px-7 py-3 text-sm font-medium text-cream transition hover:bg-forest-deep"
            >
              Sign in to dashboard
            </Link>
            <a
              href="#features"
              className="rounded-full border border-ink/15 px-7 py-3 text-sm font-medium text-ink transition hover:border-ink/30"
            >
              Explore features
            </a>
          </div>
          <dl className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              ["5", "Clinic types"],
              ["7", "Modules to switch on"],
              ["∞", "Branches & clinics"],
              ["GST", "Invoices & day-end report"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-display text-3xl text-forest">{value}</dt>
                <dd className="mt-1 text-xs text-ink/60">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl border border-sand bg-white/70 p-6 shadow-[0_1px_0_0_rgba(20,35,27,0.04)]">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-forest/10 px-3 py-1 font-data text-[10px] uppercase tracking-widest text-forest">
              Sample clinic
            </span>
            <PulseMark className="h-6 w-6" animate />
          </div>
          <p className="mt-4 font-display text-lg">Collections today</p>
          <p className="mt-1 text-sm text-ink/50">Across all enabled modules</p>
          <p className="mt-1 font-data text-4xl font-semibold text-ink">
            ₹42,380
          </p>
          <p className="mt-1 text-sm text-forest">↑ 18% vs yesterday</p>
          <svg viewBox="0 0 300 70" className="mt-6 w-full">
            <path
              d="M0 50 L30 46 L60 52 L90 30 L120 38 L150 20 L180 28 L210 15 L240 22 L270 10 L300 18"
              fill="none"
              stroke="var(--forest)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </section>

      <section id="features" className="border-t border-sand bg-white/40 px-6 py-20 sm:px-10">
        <p className="font-data text-xs uppercase tracking-[0.2em] text-clay">Product</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium sm:text-4xl">
          Everything a modern clinic needs. Nothing it doesn&apos;t.
        </h2>
        <p className="mt-4 max-w-2xl text-ink/70">
          Replace spreadsheets, chat groups and paper receipts with one
          workspace for patients, staff, marketing and revenue.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-sand bg-cream p-6">
              <h3 className="font-display text-lg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="types" className="border-t border-sand px-6 py-20 sm:px-10">
        <p className="font-data text-xs uppercase tracking-[0.2em] text-clay">Modular by design</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium sm:text-4xl">
          Start from your kind of clinic, then switch modules on or off.
        </h2>
        <p className="mt-4 max-w-2xl text-ink/70">
          Each clinic type comes with sensible defaults: modules, wording, appointment length and a starter price list.
          Change anything later from settings. Switching a module off never deletes data.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CLINIC_TYPE_KEYS.map((k) => {
            const t = CLINIC_TYPES[k];
            return (
              <div key={k} className="rounded-2xl border border-sand bg-white/50 p-6">
                <p className="font-display text-lg">{t.label}</p>
                <p className="mt-1 text-sm text-ink/60">{t.blurb}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {t.defaultModules.map((m) => (
                    <span key={m} className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[11px] text-forest">
                      {getModule(m).label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-ink/50">
          {MODULES.length} modules today. Dental charts, pharmacy, inventory, lab, radiology and IPD are on the way.
        </p>
      </section>

      <section id="modules" className="border-t border-sand px-6 py-20 sm:px-10">
        <p className="font-data text-xs uppercase tracking-[0.2em] text-clay">
          Multi-tenant · Multi-branch
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium sm:text-4xl">
          Built for franchises &amp; chains.
        </h2>
        <p className="mt-4 max-w-2xl text-ink/70">
          Every clinic is isolated behind its own tenant. Head office rolls up
          branch-level revenue. Onboard a new clinic in under a minute with
          role-based access, an audit trail and soft-delete from day one.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["Indiranagar", "₹1.8L", "142 pts"],
            ["Koramangala", "₹0.9L", "84 pts"],
            ["HSR (soon)", "—", "—"],
          ].map(([branch, revenue, pts]) => (
            <div key={branch} className="rounded-2xl border border-sand bg-white/50 p-6">
              <p className="font-display text-lg">{branch}</p>
              <p className="mt-3 font-data text-2xl text-forest">{revenue}</p>
              <p className="mt-1 text-xs text-ink/50">{pts}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-sand bg-forest px-6 py-20 text-cream sm:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-medium sm:text-4xl">
            Your clinic. Simplified.
          </h2>
          <p className="mt-4 text-cream/75">
            Explore five demo clinics: physiotherapy, dental, general, orthopaedic and a small hospital. Pick one on the sign-in page.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-full bg-cream px-8 py-3 text-sm font-medium text-forest-deep transition hover:bg-cream/90"
          >
            Sign in to demo
          </Link>
          <p className="mt-4 font-data text-xs text-cream/50">
            Demo accounts and the password are listed on the sign-in page.
          </p>
        </div>
      </section>

      <footer className="border-t border-sand px-6 py-8 text-center text-xs text-ink/50 sm:px-10">
        © {new Date().getFullYear()} {BRAND.name} — {BRAND.tagline}.
      </footer>
    </div>
  );
}
