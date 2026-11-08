# PhysioCare — Project Context for AI Agents

> **Read this first.** This file captures every critical architectural decision, past bug fix, environment setup, and coding constraint for the SAAS-Physio project. An AI agent working on this project MUST read this file before making any changes.

---

## 1. What This Project Is

**PhysioCare Clinic OS** — a multi-tenant SaaS platform for clinics and hospitals (started as physiotherapy). It manages patients (UHID), appointments, OPD visits with token queue, vitals, prescriptions, GST invoices, staff attendance, doctor ratings, and marketing campaigns. Hospital modules are being added in slices; see section 14.

- **Vercel project:** `physiocare-platform` (team kbdcreditsolutions-projects), https://physiocare-platform.vercel.app. This folder is linked to it.
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
