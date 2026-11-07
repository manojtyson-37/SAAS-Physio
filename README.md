# PhysioCare — Clinic OS

A multi-tenant SaaS platform for physiotherapy clinics. Manages patients, appointments, GST invoices, staff attendance, doctor ratings, and marketing campaigns.

**Live:** https://saas-physio.vercel.app  
**GitHub:** https://github.com/kbdcreditsolutions/SAAS-Physio

> 🤖 **AI Agents:** Read [`CONTEXT.md`](./CONTEXT.md) before making any changes.

---

## Quick Start (Local Dev)

### 1. Clone & install
```bash
git clone https://github.com/kbdcreditsolutions/SAAS-Physio.git
cd SAAS-Physio
npm install
```

### 2. Set up environment variables
Create a `.env` file at the project root:
```env
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-nameless-meadow-at954vlp-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:PASSWORD@ep-nameless-meadow-at954vlp.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
JWT_SECRET="your-secret-here"
```
> Get connection strings from [Neon Console](https://console.neon.tech) → project `silent-forest-23150019`.

### 3. Set up the database
```bash
npx prisma generate        # generate Prisma client
npx prisma migrate deploy  # apply migrations to DB
npm run seed               # seed demo accounts
```

### 4. Run dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Demo Accounts

Password for all: **`Admin@123`**. Five demo clinics, one per clinic type (also listed on the sign-in page):

| Clinic | Type | Admin | Doctor | Reception |
|---|---|---|---|---|
| Sunrise Physiotherapy | Physiotherapy | `admin@sunrisephysio.in` | `dr.arjun@sunrisephysio.in` | `reception@sunrisephysio.in` |
| BrightSmile Dental Studio | Dental | `admin@brightsmile.demo` | `dr.aditya@brightsmile.demo` | `reception@brightsmile.demo` |
| CityCare Family Clinic | General | `admin@citycare.demo` | `dr.imran@citycare.demo` | `reception@citycare.demo` |
| BoneWell Ortho & Joint Care | Orthopaedic | `admin@bonewell.demo` | `dr.suresh@bonewell.demo` | `reception@bonewell.demo` |
| Lakeview Multispeciality Hospital | Small hospital | `admin@lakeview.demo` | `dr.anita@lakeview.demo` | `reception@lakeview.demo` |

Platform super admin (all clinics): `superadmin@physiocare.io`.

Add the demo clinics to any database without touching existing data (dry run by default):

```bash
npx tsx scripts/seed-demo-clinics.ts           # shows what would be created
npx tsx scripts/seed-demo-clinics.ts --apply   # creates the missing ones
```

## Modules

Each clinic has a type (physio, dental, general, ortho, small hospital) that sets its default modules, wording, appointment length and starter price list. The clinic admin switches modules on and off under **Settings**. The registry is `lib/modules/registry.ts`, the presets `lib/modules/clinicTypes.ts`. Switching a module off hides it (menu, pages, APIs, dashboard) and never deletes data.

---|---|
| `superadmin@physiocare.io` | Super Admin (all clinics) |
| `admin@sunrisephysio.in` | Clinic Admin |
| `dr.arjun@sunrisephysio.in` | Doctor |
| `reception@sunrisephysio.in` | Staff |

---

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript 5**, **Tailwind CSS v4**
- **Prisma 6** + **Neon** (serverless PostgreSQL)
- **jose** for JWT auth (Edge-compatible)
- **bcryptjs** for password hashing
- **Recharts** for dashboard charts

---

## Project Structure

```
app/
  api/          → API routes (Node.js runtime)
  app/          → Protected app pages (/app/*)
  login/        → Auth page
  page.tsx      → Landing page
components/     → Shared UI components
lib/
  auth.ts       → JWT sign/verify (jose), session cookies
  db.ts         → Prisma client singleton
  guard.ts      → requireSession() for API routes
  scope.ts      → Tenant scoping helper
  nav.ts        → Role-based navigation
middleware.ts   → Route protection (Edge runtime)
prisma/
  schema.prisma → Database schema
  seed.ts       → Demo data seeder
```

---

## Scripts

```bash
npm run dev     # Development server
npm run build   # Production build
npm run lint    # ESLint
npm run seed    # Seed demo data
```
