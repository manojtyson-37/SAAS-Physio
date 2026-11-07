<!-- BEGIN:data-safety-hard-rule -->
# 🔴 HARD RULE: NEVER delete real data (added 2026-10-28, after a real data-loss incident)

On 2026-10-27, a `prisma migrate deploy && npm run seed` command run against this project's database wiped Appointment/Payment/ClinicalNote/AttendanceRecord/Campaign/Referral/Rating data for 158 real patients of the live `sridatriphysio` tenant. The agent said "no data was lost" without checking. The Neon free-tier PITR retention (6h) had already expired by the time it was discovered — unrecoverable. **This database is also shared with the SDPC project** (same Neon host) — check `DATABASE_URL` across sibling project folders before assuming a DB is single-project.

Before running, or handing the user, ANY command that deletes/overwrites existing rows in a database not freshly created this session (`deleteMany`, `DELETE`, `TRUNCATE`, `DROP`, `migrate reset`, `db push --force-reset`, an unguarded seed script, etc.):
1. Read-only verify actual row counts/contents first — never assume "demo"/empty from docs or naming.
2. Name the exact tables/rows/DB host and get consent for *that specific command*, every time — a prior general "yes" does not carry over.
3. Don't claim data is safe or restorable without having actually verified it (retention window, backup existence) first.
4. **This database must have real backups — it does not currently, and that's how 158 real patients' data became unrecoverable.** Production or sandbox, no DB this account touches is exempt: a sandbox can silently become production (this one did). Set up automated backups (Neon PITR retention upgrade, or a scheduled `pg_dump` to durable storage) before further destructive-capable work, or flag their absence explicitly to the user.
<!-- END:data-safety-hard-rule -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:saas-physio-rules -->
# MANDATORY: Read CONTEXT.md First

Before making ANY changes to this project, read `CONTEXT.md` at the project root. It contains the full architecture, bug log, environment setup, and all critical constraints. Failure to read it risks re-introducing bugs that were already fixed.

# Edge Runtime Constraints

- Do not use Node.js specific libraries (e.g., `jsonwebtoken`, `crypto`, `fs`) in `middleware.ts` or any code it imports, as it runs on the Edge runtime in Vercel. Use Edge-compatible alternatives like `jose`.
- `export const runtime = "nodejs";` is INVALID for middleware in App Router. Do not add it.
- `verifySession()` in `lib/auth.ts` is async — always `await` it.
- The `middleware()` function must be `async` because it awaits `verifySession()`.

# Database Rules (Neon + Prisma)

- Always ensure `prisma/schema.prisma` has BOTH `url` AND `directUrl`:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DATABASE_URL_UNPOOLED")
  }
  ```
- Never run `prisma migrate dev` against production. Use `prisma migrate deploy` only.
- After any schema change, run `npx prisma generate` to regenerate the client.

# Multi-Tenant Data Isolation

- All database queries MUST use `tenantScope(session)` from `lib/scope.ts` to filter by tenant.
- Never query across tenants unless the user role is `SUPER_ADMIN`.
- `SUPER_ADMIN` has no `tenantId` (it is `null`).

# Security

- Never expose JWT_SECRET, DATABASE_URL passwords, or any secrets in code, logs, or error responses.
- API error responses must not include stack traces or internal error details in production.
<!-- END:saas-physio-rules -->
