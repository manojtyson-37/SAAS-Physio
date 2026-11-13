# PhysioCare — Project Context for AI Agents

> **Read this first.** This file captures every critical architectural decision, past bug fix, environment setup, and coding constraint for the SAAS-Physio project. An AI agent working on this project MUST read this file before making any changes.

---

## 1. What This Project Is

**PhysioCare Clinic OS** — a multi-tenant SaaS platform for clinics and hospitals (started as physiotherapy). It manages patients (UHID), appointments, OPD visits with token queue, vitals, prescriptions, GST invoices, staff attendance, doctor ratings, and marketing campaigns. Hospital modules are being added in slices; see section 14.

- **Vercel project:** `physiocare-platform` (team kbdcreditsolutions-projects), https://clinicos-cloud.vercel.app (public/pitch URL, added 2026-11-08; `clinicos.vercel.app` is taken by someone else). The original https://physiocare-platform.vercel.app still works. This folder is linked to it. Use the clinicos-cloud URL in demos and links.
- **GitHub:** `manojtyson-37/SAAS-Physio` (branch `main`) is the new repo. The old `kbdcreditsolutions/SAAS-Physio` (master) and old Vercel project `saas-physio` are legacy; `saas-physio` is still attached to the SDPC shared DB. Do not deploy to it.

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.10 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL via **Neon** (serverless) |
| ORM | Prisma 6.x |
| Auth | `jose` (JWT) + `bcryptjs` (passwords) |
| Deployment | Vercel (kbdcreditsolutions-projects team) |
| Charts | Recharts |

---

## 3. ⚠️ Critical Runtime Constraint — Edge vs Node.js

**This is the most common source of bugs in this project.**

Next.js `middleware.ts` runs on the **Vercel Edge Runtime** — NOT Node.js. This means:

### NEVER do this in middleware.ts or any file it imports:
- ❌ `import jwt from "jsonwebtoken"` — Node.js only, crashes on Edge
- ❌ `import crypto from "crypto"` — Node.js only
- ❌ `import fs from "fs"` — Node.js only
- ❌ `export const runtime = "nodejs"` — INVALID in middleware, silently ignored or errors

### ALWAYS use instead:
- ✅ `import * as jose from "jose"` — Edge-compatible JWT library
- ✅ `bcryptjs` is fine in API routes (Node.js runtime) but NOT in middleware

### How it manifests when broken:
- The login API returns `HTTP 500` with an **empty body** (no JSON)
- The middleware crashes silently on Vercel Edge
- Locally it may work fine because `next dev` runs differently

---

## 4. Authentication Architecture

```
Client (browser)
  → POST /api/auth/login  (Node.js runtime — can use Prisma, bcryptjs)
    → verifyPassword() with bcryptjs
    → setSessionCookie() → signs JWT with jose, sets httpOnly cookie
  
middleware.ts  (Edge runtime — only jose allowed)
  → reads "physiocare_session" cookie
  → await verifySession(token) → jose.jwtVerify()
  → redirects /app → /login if no valid session
  → redirects /login → /app if already authenticated
```

**Key files:**
- [`lib/auth.ts`](lib/auth.ts) — JWT sign/verify with `jose`, cookie management
- [`middleware.ts`](middleware.ts) — route protection (Edge runtime)
- [`lib/guard.ts`](lib/guard.ts) — `requireSession()` helper for API routes
- [`app/api/auth/login/route.ts`](app/api/auth/login/route.ts) — login handler
- [`app/api/auth/logout/route.ts`](app/api/auth/logout/route.ts) — logout handler

**Cookie name:** `physiocare_session`  
**JWT algorithm:** HS256  
**JWT expiry:** 7 days  

---

## 5. Database Setup — Neon + Prisma

### Databases (as of 2026-11-07)
- **DO NOT USE** `neon-cinereous-lens` (`ep-nameless-meadow-at954vlp…`): shared with SDPC production. This project's env was removed from it on 2026-10-28 after a data-loss incident (see AGENTS.md).
- **Production:** Vercel-Marketplace Neon store `neon-carmine-zebra` (`ep-dawn-night-b8yilwdk…`, us-east-1) attached to `physiocare-platform`. Treat as live. Daily dumps go to the Blob store `physiocare-platform-db-backups`. Pull env with `vercel env pull .env.production.pulled --environment production` (gitignored).
- **Dev:** Neon project `saas-physio-hospital` (`polished-bread-96164092`, ap-southeast-1, org "Manoj"), in local `.env`. Daily 02:00 launchd job runs `scripts/backup-db.sh` to `~/Backups/saas-physio/`. Safe to seed/reset.
- Postgres is 18.x: use `postgresql@18` client tools (`/opt/homebrew/opt/postgresql@18/bin`) for pg_dump/psql.

### Critical: Neon uses PgBouncer connection pooling

Prisma requires **two** separate connection strings:

| Variable | URL type | Used for |
|---|---|---|
| `DATABASE_URL` | **Pooled** (has `-pooler.` in hostname) | App runtime queries |
| `DATABASE_URL_UNPOOLED` | **Direct** (no `-pooler.`) | Prisma migrations (`directUrl`) |

### schema.prisma MUST have:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}
```
If `directUrl` is missing, `prisma migrate deploy` will fail or behave unpredictably.

### Running migrations:
```bash
npx prisma generate         # regenerate client after schema changes
npx prisma migrate deploy   # apply pending migrations to Neon
SEED_CONFIRM_WIPE=<db host> npm run seed   # WIPES ALL TABLES; refuses to run without the exact host (dev DB only!)
```

### Prisma schema location: `prisma/schema.prisma`

---

## 6. Required Environment Variables

### On Vercel (kbdcreditsolutions-projects/saas-physio → Settings → Env Vars)
| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Auto-injected by Neon integration | Pooled connection |
| `DATABASE_URL_UNPOOLED` | Auto-injected by Neon integration | Direct connection |
| `JWT_SECRET` | **Manually added** | Generate: `openssl rand -hex 32` |

### Local `.env` file (not committed to git):
```env
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-nameless-meadow-at954vlp-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:PASSWORD@ep-nameless-meadow-at954vlp.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
JWT_SECRET="<generate with: openssl rand -hex 32>"
```

---

## 7. Demo Accounts (seeded via `prisma/seed.ts`)

**Password for all accounts:** `Admin@123`

| Email | Name | Role | Tenant |
|---|---|---|---|
| `superadmin@physiocare.io` | Platform Super Admin | SUPER_ADMIN | — (platform level) |
| `admin@sunrisephysio.in` | Priya Menon | CLINIC_ADMIN | Sunrise Physio |
| `dr.arjun@sunrisephysio.in` | Dr. Arjun Iyer | DOCTOR | Sunrise Physio |
| `reception@sunrisephysio.in` | Reception Staff | STAFF | Sunrise Physio |

---

## 8. Multi-Tenant Data Model

The app is multi-tenant. Key scoping rules:

- `SUPER_ADMIN` → no `tenantId`, sees ALL clinics via `/app/clinics`
- `CLINIC_ADMIN`, `DOCTOR`, `STAFF` → scoped to their `tenantId`
- All queries must use `tenantScope(session)` from [`lib/scope.ts`](lib/scope.ts) to prevent cross-tenant data leakage
- Branches belong to a Tenant; Users and Patients belong to a Tenant + optionally a Branch

### Core data models (in `prisma/schema.prisma`):
`Tenant` → `Branch` → `User`, `Patient`  
`Patient` → `Package`, `Invoice`, `Appointment`, `ClinicalNote`, `AttendanceRecord`  
`Invoice` → `InvoiceLineItem`, `Payment`  
`Doctor (User)` → `Appointment` → `ClinicalNote`, `Rating`
Hospital core: `Patient` → `Visit` (token per tenant per IST day) → `Vitals[]`, `Prescription` (1:1) → `PrescriptionItem[]`. `Tenant.facilityType` (CLINIC|HOSPITAL), `Tenant.uhidPrefix/uhidSeq` drive UHID allocation.

---

## 9. App Route Structure

```
/                     → Landing page (public)
/login                → Auth page (redirects to /app if logged in)
/app                  → Dashboard (protected)
/app/patients         → Patient list + add
/app/patients/[id]    → Patient detail (notes, packages, invoices)
/app/appointments     → Appointment calendar/list
/app/opd              → OPD token queue (today), issue tokens
/app/opd/[id]         → Visit workspace: vitals, consultation, prescription, print
/app/invoices         → Invoice list
/app/invoices/[id]    → Invoice detail + payment
/app/staff            → Staff management
/app/attendance       → Attendance tracking
/app/ratings          → Doctor rating dashboard
/app/marketing        → Campaign management
/app/clinics          → SUPER_ADMIN only — all tenant management
```

---

## 10. Known Issues Fixed (Bug Log)

### 2026-07-06 — Login 500 Error on Vercel
**Symptom:** Login page loaded but clicking "Sign in" returned HTTP 500 with empty body.  
**Root cause:** `lib/auth.ts` used `jsonwebtoken` which is Node.js-only. `middleware.ts` imported it, causing the Edge runtime to crash silently.  
**Fix:**
1. Replaced `jsonwebtoken` with `jose` in `lib/auth.ts`
2. Made `signSession()` and `verifySession()` async (jose is Promise-based)
3. Removed `export const runtime = "nodejs"` from `middleware.ts` (invalid)
4. Made `middleware()` function `async` to properly `await verifySession()`
5. Added `directUrl = env("DATABASE_URL_UNPOOLED")` to `prisma/schema.prisma` for Neon PgBouncer compatibility
6. Seeded Neon DB with `npm run seed` after setting up real env vars

---

## 11. Vercel CLI Notes

The Vercel CLI (`vercel`) is authenticated as `manojsuperb09-7598` which belongs to team `manojsuperb09-7598s-projects`. The actual production project lives under `kbdcreditsolutions-projects` team (different account). Use the Vercel dashboard UI for env var management on the production project.

---

## 12. Middleware Deprecation Warning

Next.js 16.x shows:
```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```
This is a warning only — `middleware.ts` still works. Migration to `proxy.ts` can be done in a future sprint. Do NOT rename it yet without testing.

---

## 13. Scripts

```bash
npm run dev       # start dev server (Turbopack)
npm run build     # production build
npm run lint      # ESLint
SEED_CONFIRM_WIPE=<db host> npm run seed   # destructive; dev DB only
npm test          # vitest unit tests (lib/**/*.test.ts)
```

---

## 14. Hospital build (started 2026-11-07)

Plan ("clinic core first"): Foundations (UHID, Visit, Vitals, Rx) → OPD queue/EMR → billing upgrade → Pharmacy + Inventory → Lab + Radiology → IPD/ICU/Discharge → Speech-to-Rx / tablet writing.

**Slice 1 (built, dev-verified, NOT yet migrated to production):**
- Migration `20261107130000_hospital_core_visit_vitals_rx` is additive only (new tables; nullable/defaulted columns on Patient and Tenant). Apply to prod only after the user approves the exact `prisma migrate deploy` command.
- UHID: `lib/hospital/uhid.ts`, one atomic `UPDATE uhidSeq+1`; gaps possible, duplicates not. Existing patients have `uhid = NULL` until a (guarded) backfill is approved.
- Tokens: `app/api/visits/route.ts`, per-tenant per-IST-day, serialized by `pg_advisory_xact_lock`, unique constraint as backstop.
- Prescription: generic name required (NMC rule); one Rx per visit; locked once the visit is COMPLETED/CANCELLED.
- Roles: STAFF registers, issues tokens and records vitals; DOCTOR/CLINIC_ADMIN consult, diagnose, prescribe, complete. SUPER_ADMIN (no tenant) is blocked from clinical routes.
- Tests: `npm test` (unit), plus the e2e script approach used in the session (API-level, against the dev DB only).

**API hygiene rule:** never return raw `User` rows (they carry `passwordHash`). Use `select` whitelists. Fixed in doctors, appointments, patient detail, notes, staff PATCH, clinics POST on 2026-11-07.

*Last updated: 2026-11-07 (hospital slice 1, infra isolation, backups).*

## Billing (added 2026-11-08)
- Invoice numbers come from `Tenant.invoiceSeq`, incremented inside the invoice-create transaction (gap free, never resets by year). Migration `billing_core` seeded it from each clinic's highest existing number. Never go back to `count + 1`.
- Money is computed in integer paise (`lib/hospital/billing.ts`); discount is taken off the GST-inclusive total. Confirm GST treatment with the clinic's accountant (healthcare services are generally exempt, starter price list uses 0%).
- Payments lock the invoice row (`FOR UPDATE`), refuse overpayment, and are idempotent through `clientRef`. Invoices with payments cannot be edited or cancelled (no refunds yet).
- `CANCELLED` invoices stay on record and are excluded from patient, dashboard and outstanding totals; any new code summing invoices must exclude them and `deletedAt`.
- After changing the schema run `npx prisma generate` AND restart the dev server (a stale client shows up as `PrismaClientValidationError` 500s). With CI auto-deploy on push to `main`, apply prod migrations BEFORE pushing.

## Modules and clinic types (added 2026-11-08)
- `Tenant.clinicType` (PHYSIOTHERAPY, DENTAL, GENERAL, ORTHO, HOSPITAL) and `Tenant.enabledModules` (text[]). Registry: `lib/modules/registry.ts` (module keys, nav, page prefixes, planned modules); presets: `lib/modules/clinicTypes.ts`. Existing clinics were backfilled with every module, so nothing disappeared.
- Enforcement is three layers: sidebar (`getNavItems(role, modules)`), pages (a `layout.tsx` per module calling `assertModulePage`, 404 when off), APIs (`moduleGate(session, key)` at the top of every handler). Dashboard computes a section only for enabled modules. When adding a module: registry entry, a layout for its pages, `moduleGate` in each API handler, and add it to the presets.
- Core areas (dashboard, patients, staff, settings) are never gated. SUPER_ADMIN has no clinic and passes every gate.
- Brand name lives in `lib/brand.ts` (one-line rename). The session cookie name `physiocare_session` is intentionally unchanged (renaming would log everyone out).
- Demo clinics: `prisma/demoClinics.ts`, added with `scripts/seed-demo-clinics.ts` (additive, idempotent, dry-run by default). The wiping `prisma/seed.ts` also creates them. Logins in `lib/demoAccounts.ts` and README.
- Dashboard "today" is the India calendar day (`istDayRange`), not the server timezone.

## Inventory & pharmacy (added 2026-11-08)
- Two modules: `inventory` (items, batches with expiry, suppliers, receipts, adjustments, ledger) and `pharmacy` (dispense a prescription or counter sale). `pharmacy` requires `inventory`: `withRequirements()` (lib/modules/resolve.ts) adds it whenever a selection is saved.
- Models: Supplier, StockItem (generic name matches prescriptions), StockBatch (`qtyOnHand`, `expiryDate` DATE = last dispensable day, per-batch `salePrice`), StockMovement (append-only signed ledger, one row per quantity change), Dispensation + DispensationLine. Quantities are whole units.
- Dispensing (lib/pharmacy/dispense.ts): batches locked `FOR UPDATE` per item (items sorted by id) then allocated oldest-expiry-first (`allocateFefo`, expired batches never used), CAS decrement, then a pharmacy Invoice (shares `Tenant.invoiceSeq`) when billing is on. Lock order is batches then tenant row; nothing locks them the other way. `clientRef` makes a double click a no-op.
- Void (`voidDispensation`): row-locks the dispensation, returns stock to the same batches (ledger VOID_RETURN), cancels the invoice if unpaid; refused once any payment exists.
- Receive uses a raw `INSERT ... ON CONFLICT (itemId, batchNo) DO UPDATE` so concurrent receipts both count; re-receiving a batch with a different expiry is rejected.
- `PATCH` schemas must NOT reuse create schemas with defaults (zod `.partial()` re-applies defaults and silently reset GST/unit once).
- Demo: `scripts/seed-demo-stock.ts` (dry-run default, `--apply`, additive, skips clinics that already have stock) stocks CityCare, BoneWell, Lakeview (inventory + pharmacy) and BrightSmile (inventory).
- Tests: `lib/pharmacy/stock.test.ts` (FEFO, expiry, rx quantity). Concurrency e2e lives in the session scratchpad (`pharmacy_e2e.py`): 6 parallel dispenses of 10 against 41 units => exactly 4 succeed.

## Clinical suite (added 2026-11-08): dental chart, exercise plans, lab, radiology, IPD, discharge
- Modules `dental_chart`, `exercise_plans`, `lab`, `radiology`, `ipd`, `discharge` (discharge requires ipd). One additive migration `20261108062204_modules_clinical_suite` (incl. a hand-written partial unique index `Admission_bedId_admitted_key`: one ADMITTED admission per bed; Prisma does not manage it, leave it).
- Billing from any module goes through `lib/hospital/invoiceTx.ts` (`createInvoiceInTx`, `cancelUnpaidInvoiceInTx`); invoice ids on orders/plans/admissions are plain strings (no FK).
- Per-clinic counters on Tenant: `labSeq` (LAB-000001), `imagingSeq` (IMG-), `admissionSeq` (ADM-), allocated inside the transaction.
- IPD bed charges: per stay, `max(1, ceil(hours/24))` days at the bed's snapshotted daily rate; billed at discharge when billing is on. A transfer shortly after admission therefore bills a minimum day per bed (policy to confirm with the clinic).
- Discharge summary read and write: DOCTOR + CLINIC_ADMIN only; FINAL is immutable. Lab/imaging prefill reads those tables only when those modules are on.
- Exercise plan items are hard-deleted when removed from an ACTIVE plan; the audit row keeps a full snapshot.
- Patient page tabs embed `Patient*Panel` components per module; dashboard cards per module.
- Demo data: `scripts/seed-demo-suite.ts` (dry run default; `--apply --host=<part of DB host>` required; additive; skips sections that already have data).
- e2e scripts live in the session scratchpad (`lab|radiology|dental|exercise|ipd|discharge|pharmacy_e2e.py`); all passed on dev on 2026-11-08.
- Imaging uploads (2026-11-08): JPEG/PNG/WebP/PDF, 4 MB each, 20 per order, stored in the PRIVATE Blob store (same store as DB backups, separate `imaging/<tenantId>/<orderId>/` prefix; local dev writes to `.uploads/`). Files have no public URL: served only by `/api/radiology/orders/[id]/attachments/[attId]/file` (tenant-checked, nosniff, CSP sandbox, PDFs always download). Admin "Remove" is a soft delete: the row and the blob are kept, so an erasure request needs a manual blob delete (`vercel blob del`) plus a note in the audit log.
- Removal policy: every remove/revoke endpoint is CLINIC_ADMIN only and soft (exercise templates/items, dental chart undo, dental plan item, attachments). Remaining hard deletes are the replace-on-edit of invoice line items and prescription items (inside transactions).
- IPD "Bill bed charges" (`POST /api/ipd/admissions/[id]/bill`) invoices a discharged admission with no active invoice; locked per admission, double clicks create one invoice.

## Platform console, subscriptions and logins (added 2026-11-08)
- **Logins:** `SUPER_ADMIN` = platform owner; `ONBOARDING` = onboarding team (no clinic, no patient data: `requireSession` denies it everywhere except routes that list it, `tenantScope` throws for it). Create or reset either with `npx tsx scripts/create-platform-login.ts --email=... --name=... --role=SUPER_ADMIN|ONBOARDING [--retire=old@email] [--apply --host=<part of DB host>]`: random password written to `~/.clinicos-credentials/<email>.txt` (mode 600), never printed; the login must choose its own password at first sign-in. The old public demo owner `superadmin@physiocare.io` must be retired on prod (it used the shared demo password).
- **Console:** `/app/platform` (clinics: onboard, subscription, modules, details, admin password reset), `/app/platform/team` (owner only: onboarding logins). APIs under `/api/platform/**`; owner-only rules live in `applyAction` (lib/platform/subscription.ts), not in the UI.
- **Subscription:** Tenant.subscriptionStatus TRIAL|ACTIVE|SUSPENDED|CANCELLED + trialEndsAt/paidThrough. Computed on the fly (`subscriptionView`): TRIAL after its end = read-only; ACTIVE past `paidThrough` = 7-day grace then read-only; SUSPENDED = blocked; CANCELLED = read-only. Existing clinics were grandfathered ACTIVE with no end date. New clinics from the console start a 14-day trial (max 60 for onboarding), `selfServiceModules=false` (clinic admin cannot change modules). Payment is manual (owner activates with a plan and paid-through date); no payment gateway yet.
- **Enforcement:** `lib/guard.ts requireSession` re-reads user + clinic on every API call (deactivation, suspension and trial end take effect at once), blocks writes when read-only (402) using the real HTTP method that middleware stamps in `x-cos-method`, and rejects sessions issued before the last password change (`passwordChangedAt`). The app layout shows the trial banner, the suspended screen, or the forced password change.
- **Sign-in throttle:** 8 failures per address+login or 40 per login in 15 minutes (AuditLog `LOGIN_FAILED`); an attacker cannot lock the owner out from another address.
- **Temporary passwords** (new clinic admin, resets): shown once, `Cache-Control: no-store`, `mustChangePassword`. The onboarding team can only reset an admin who has never signed in; the owner can reset any.
- **Owner Overview (`/app` for SUPER_ADMIN):** `GET /api/platform/overview`: clinics by plan state, new onboardings (and admins who have not signed in), trials ending and renewals due, queries waiting on us, and revenue (owner only; the onboarding team gets `revenue: null`). It reads counts and names only, never clinic patient/visit/invoice data. `/api/dashboard` is 403 for the owner.
- **Revenue ledger:** `SubscriptionPayment`, written when the owner activates/renews with an amount (`POST /api/platform/clinics/[id]/subscription` action `activate` with `amount`, `method`, `reference`). Same amount for the same clinic within 2 minutes is refused (double-click guard). There is no edit/void yet: a mistaken entry needs a manual fix.
- **Support queries:** clinics raise queries at `/app/support` (every clinic role; admin sees all of the clinic's, others only their own); the platform team works them at `/app/platform/support` (owner + onboarding). `requireSession(..., { allowWhenReadOnly: true })` keeps the support routes usable by clinics whose trial/subscription ended; suspended clinics are blocked everywhere. Caps: 10 new queries and 30 messages per user per hour.
- **Platform roles are deny-by-default in `requireSession`** (both SUPER_ADMIN and ONBOARDING must be named by the route), and `tenantScope` throws without a clinic. This is what stops the owner login from reading clinic data through ordinary clinic routes.
- Dev note: the Claude preview harness stops the dev server after about 11 minutes (exit code 0). "Connection refused" in a long e2e run is that, not a crash.

## Click speed (added 2026-11-08, user complaint: "each click takes eternity")
- Cause: DB (Neon) and functions run in US-East (`iad1`); users are in India, so every server round trip costs ~350 ms. A click = page request + client data fetch(es) = 0.7 s+ with no feedback.
- Rules: (1) every `app/app/**` route group keeps a `loading.tsx` skeleton so a click responds instantly and Next can prefetch the shell; (2) one DB read per request for user+clinic (layout does it in one query; `requireSession` parks `enabledModules` in `lib/modules/sessionModules.ts` for `moduleGate`) - never add a second read of the same row; (3) prefer data in the first response over a client `useEffect` fetch waterfall; (4) run `scripts/perf-check.sh <url>` before and after shipping UI work (budget 700 ms median per call from the dev machine).
- Trade-off: because `loading.tsx` streams first, a module-off page returns HTTP 200 with the 404 UI (`noindex`); the data APIs still return 403. Tests must check the body, not the status.
- The structural fix is moving the database (and function region) near users (e.g. Neon Singapore + `sin1`); that is a prod data move and needs explicit approval.

## Tenant resolution on writes (added 2026-11-13, after a cross-tenant write was found in a readiness audit)
`requireSession` proves **who** is calling. It says nothing about whether an id in the URL or the request body
belongs to that caller's clinic. Four routes had made that mistake: `patients/[id]/notes` (wrote a `ClinicalNote`
into another clinic's medical record), `appointments` POST (wrote an appointment against a foreign patient/doctor
*and* returned the foreign patient row in the response), `patients/[id]/packages` POST, and `attendance` POST.
A patient id is not a secret — it sits in URLs, invoices and screenshots — so the UUID is a speed bump, not a control.

Rule: **any route that writes a row hanging off an id from the request must first resolve that id inside
`session.tenantId` and return 404 when it does not match.** Use the where-clauses in
[`lib/tenant/guards.ts`](lib/tenant/guards.ts) (`patientInTenant`, `activeDoctorInTenant`, `activeUserInTenant`)
rather than retyping the filter per route; `lib/tenant/guards.test.ts` filters a two-tenant fixture through each one.
Modules whose rows carry no `tenantId` of their own — `ClinicalNote`, `DispensationLine`, `ExercisePlanItem`,
`InvoiceLineItem`, `LabOrderItem`, `Payment`, `PrescriptionItem`, `SupportMessage`, `TreatmentPlanItem` — depend
entirely on this, because no downstream `tenantScope` can catch a wrong parent. Writing a denormalised `tenantId`
onto `ClinicalNote` (as the newer models carry) is the structural fix and needs a migration against the live DB.
