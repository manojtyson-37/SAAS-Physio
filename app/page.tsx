import Link from "next/link";
import { PulseMark } from "@/components/PulseMark";
import { BRAND } from "@/lib/brand";
import { CLINIC_TYPES, CLINIC_TYPE_KEYS } from "@/lib/modules/clinicTypes";
import { MODULES, getModule } from "@/lib/modules/registry";
import {
  SALES,
  emailLink,
  formatInr,
  phoneLink,
  whatsappLink,
} from "@/lib/sales";

const FRONT_DESK = [
  "Answers timings, fees, location and services from what you tell it",
  "Books, moves and cancels against each doctor's working hours",
  "Reminds tomorrow's patients, and puts a given-up slot back on offer",
  "Sends a payment link for a consult fee or a deposit",
  "Hands over to your staff in the same thread, and can be switched off",
  "Refuses to diagnose: urgent symptoms go to a phone call or 112",
];

const SETUP = [
  "We file your WhatsApp Business API application and handle the back-and-forth; Meta decides if and when it is approved",
  "We apply to a payment gateway, or set up your own UPI, so patients can pay from the chat",
  "What only you can do: Meta's business verification and display-name review, proving you own the number, and the gateway's KYC — PAN, bank details, GST where it applies — and its terms, which you sign yourself",
  "Payments are designed to go to your own gateway or UPI account. We do not plan to hold or settle patient funds",
  "Your fees, doctors, slots and FAQs loaded in before you go live",
];

const INCLUDED = [
  "Set up with your own doctors, services, slot lengths and price list",
  "A login for everyone in the clinic, with what each role may see",
  "Your staff shown the screens they actually use, on a call or in person",
  "We switch modules on or off as you go; switching one off never deletes data",
  "Us on WhatsApp or the phone while you settle in",
];

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
  const wa = whatsappLink(
    `Hi, I run a clinic and I would like to see ${BRAND.name}.`,
  );
  const tel = phoneLink();
  const mail = emailLink(`${BRAND.name} enquiry`);
  const hasContact = Boolean(wa || tel || mail);
  const hasPrice = SALES.setupInr !== null || SALES.monthlyInr !== null;

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
          <a href="#frontdesk" className="hover:text-ink">
            Front desk <span className="text-ink/70">(in development)</span>
          </a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          {hasContact && (
            <a href="#contact" className="hover:text-ink">Talk to us</a>
          )}
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
              See a demo clinic
            </Link>
            <a
              href={hasContact ? "#contact" : "#features"}
              className="rounded-full border border-ink/40 px-7 py-3 text-sm font-medium text-ink transition hover:border-ink"
            >
              {hasContact ? "Talk to us" : "Explore features"}
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
        <div className="mt-8 inline-flex items-center rounded-full bg-forest/10 px-3 py-1 font-data text-[10px] uppercase tracking-widest text-forest">
          Sample roll-up, not a real clinic
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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

      <section id="frontdesk" className="border-t border-sand px-6 py-20 sm:px-10">
        <p className="font-data text-xs uppercase tracking-[0.2em] text-clay">
          Pilot scope, not built yet
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium sm:text-4xl">
          A WhatsApp front desk, answering while you are with a patient.
        </h2>
        <p className="mt-4 max-w-2xl text-ink/70">
          The call you miss mid-procedure and the message that arrives at 10 pm
          are where bookings leak away. We are building a WhatsApp assistant on
          top of {BRAND.name} to catch them. It is not built yet and not live
          anywhere — the first clinics on it shape what it does.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="rounded-3xl border border-sand bg-white/50 p-6">
            <p className="font-display text-lg">What it is designed to do</p>
            <ul className="mt-4 space-y-3">
              {FRONT_DESK.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink/70">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-sand bg-white/50 p-6">
            <p className="font-display text-lg">We do the paperwork we can do for you</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">
              Getting a clinic onto WhatsApp&apos;s Business API and a payment
              gateway is the part owners give up on. We drive it for you and
              tell you plainly which steps only you can sign.
            </p>
            <ul className="mt-4 space-y-3">
              {SETUP.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink/70">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-ink/70">
              Meta and the gateway set their own verification steps and timelines,
              and WhatsApp&apos;s per-message charges are billed by Meta, separately
              from anything you pay us.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-sand bg-white/40 px-6 py-20 sm:px-10">
        <p className="font-data text-xs uppercase tracking-[0.2em] text-clay">Pricing</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium sm:text-4xl">
          One plan per clinic, set up with you.
        </h2>
        <p className="mt-4 max-w-2xl text-ink/70">
          Everyone in the clinic gets their own login, and each role sees only
          what it needs. What you pay depends on the modules you switch on and
          how many branches you run.
        </p>
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="rounded-3xl border border-sand bg-cream p-6 shadow-[0_1px_0_0_rgba(20,35,27,0.04)]">
            {hasPrice ? (
              <dl className="space-y-4">
                {SALES.setupInr !== null && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-ink/65">Setup, one time</dt>
                    <dd className="font-data text-2xl font-semibold text-ink">
                      {formatInr(SALES.setupInr)}
                    </dd>
                  </div>
                )}
                {SALES.monthlyInr !== null && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-ink/65">Per clinic, per month</dt>
                    <dd className="font-data text-3xl font-semibold text-ink">
                      {formatInr(SALES.monthlyInr)}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <>
                <p className="font-display text-xl">Priced on a short call</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  We go through your clinic, the modules you want and the number
                  of branches, and then tell you what it would cost you.
                </p>
              </>
            )}
            {(SALES.taxNote || SALES.offerNote) && (
              <p className="mt-5 text-xs leading-relaxed text-ink/70">
                {[SALES.taxNote, SALES.offerNote].filter(Boolean).join(" ")}
              </p>
            )}
            {hasContact ? (
              <a
                href="#contact"
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-forest px-7 py-3 text-sm font-medium text-cream transition hover:bg-forest-deep sm:w-auto"
              >
                Ask what it would cost you
              </a>
            ) : (
              <Link
                href="/login"
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-forest px-7 py-3 text-sm font-medium text-cream transition hover:bg-forest-deep sm:w-auto"
              >
                See a demo clinic
              </Link>
            )}
          </div>
          <div>
            <p className="font-display text-lg">What setting up includes</p>
            <ul className="mt-4 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink/70">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-sand bg-forest px-6 py-20 text-cream sm:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-data text-xs uppercase tracking-[0.2em] text-cream/75">
            Talk to us
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium sm:text-4xl">
            Have a look at your clinic&apos;s day in it.
          </h2>
          <p className="mt-4 text-cream/75">
            Sign in to a demo clinic and move around it yourself: physiotherapy,
            dental, general, orthopaedic or a small hospital.
            {hasContact
              ? " Or ask us, and we will walk you through it on your own numbers."
              : " Pick one on the sign-in page."}
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-cream px-6 py-3 text-sm font-medium text-forest-deep transition hover:bg-cream/90"
            >
              See a demo clinic
            </Link>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream/50 px-6 py-3 text-sm font-medium text-cream transition hover:border-cream"
              >
                WhatsApp us<span className="sr-only"> (opens WhatsApp)</span>
              </a>
            )}
            {tel && (
              <a
                href={tel}
                aria-label="Call us"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream/50 px-6 py-3 text-sm font-medium text-cream transition hover:border-cream"
              >
                Call {SALES.phone}
              </a>
            )}
            {mail && (
              <a
                href={mail}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream/50 px-6 py-3 text-sm font-medium text-cream transition hover:border-cream"
              >
                Email us
              </a>
            )}
          </div>
          <p className="mt-5 font-data text-xs text-cream/75">
            Demo accounts and the password are listed on the sign-in page.
            {hasContact
              ? ` We use what you send us only to reply about ${BRAND.name}.`
              : ""}
          </p>
        </div>
      </section>

      <footer className="border-t border-sand px-6 py-8 text-center text-xs text-ink/50 sm:px-10">
        © {new Date().getFullYear()} {BRAND.name} — {BRAND.tagline}.
      </footer>
    </div>
  );
}
